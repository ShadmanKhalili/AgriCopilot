/**
 * Phase 9: ask the assistant (POST /api/assistant).
 *
 * The server is stateless: it gets the new message plus the last few turns and
 * answers from its tools. Saving the conversation is assistantThreads.ts.
 *
 * Auth follows callAiProxy in ai.ts: a Firebase ID token (a guest session is
 * created when needed) plus the App Check header when it is configured. Asking
 * goes through its own slot limiter so one device never has two questions in
 * flight. (ai.ts keeps its limiter private, and importing ai.ts would pull its
 * whole prompt library into the Ask screen, so this file makes its own with the
 * same helper.)
 */

import { createSlotLimiter } from './aiQueue';
import { ensureAiSession, getAppCheckHeader } from '../firebase';
import { fetchWithTimeout, FetchTimeoutError, readJsonWithTimeout } from '../utils/fetchWithTimeout';
import { isSafetyBlockError, SAFETY_BLOCK_CODE, safetyBlockMessage } from '../utils/safetyBlock';
import {
  ASSISTANT_SOURCES,
  type AssistantHistoryTurn,
  type AssistantLang,
  type AssistantRequest,
  type AssistantResponse,
  type AssistantSource,
  type AssistantToday,
  type AssistantToolCall,
} from '../constants/assistant';

export type { AssistantRequest, AssistantResponse };

/** One question may take a while (tools, then the model); the server stops at about 9 s. */
export const ASSISTANT_TIMEOUT_MS = 20000;

export const ASK_MESSAGE_MAX = 2000;
export const ASK_HISTORY_MAX_TURNS = 12;
export const ASK_HISTORY_TEXT_MAX = 4000;
export const ASK_ATTACHMENT_MAX = 3000;
/** The server refuses a body over 32 KB; stay a little under it. */
export const ASK_BODY_MAX_BYTES = 31000;

export type AssistantErrorKind = 'offline' | 'limit' | 'capacity' | 'auth' | 'server' | 'blocked';

export class AssistantError extends Error {
  kind: AssistantErrorKind;
  /**
   * The server's machine-readable code when it sent one. A safety refusal has
   * the same code the crop doctor already recognises (see utils/safetyBlock.ts),
   * so isSafetyBlockError(error) is true for it.
   */
  code?: string;
  constructor(kind: AssistantErrorKind, message: string, code?: string) {
    super(message);
    this.name = 'AssistantError';
    this.kind = kind;
    if (code) this.code = code;
  }
}

const MESSAGES: Record<Exclude<AssistantErrorKind, 'blocked'>, { bn: string; en: string }> = {
  offline: {
    bn: 'ইন্টারনেট নেই। সংযোগ ফিরলে আবার জিজ্ঞাসা করুন।',
    en: 'No internet connection. Please ask again when you are back online.',
  },
  limit: {
    bn: 'আজকের জিজ্ঞাসার সীমা শেষ। কাল আবার জিজ্ঞাসা করুন।',
    en: 'You have used up your allowance of questions for today. Please ask again tomorrow.',
  },
  capacity: {
    bn: 'আজ সেবাটি খুব ব্যস্ত। একটু পরে আবার চেষ্টা করুন।',
    en: 'The service is very busy right now. Please try again a little later.',
  },
  auth: {
    bn: 'আপনার পরিচয় যাচাই করা যায়নি। অ্যাপ বন্ধ করে আবার খুলুন, অথবা আবার লগইন করুন।',
    en: 'We could not confirm who you are. Please reopen the app or sign in again.',
  },
  server: {
    bn: 'এই মুহূর্তে উত্তর দেওয়া গেল না। একটু পরে আবার চেষ্টা করুন।',
    en: 'Sorry, I could not answer just now. Please try again in a moment.',
  },
};

export const assistantErrorMessage = (kind: AssistantErrorKind, lang: AssistantLang): string =>
  kind === 'blocked' ? safetyBlockMessage(lang === 'en' ? 'en' : 'bn') : MESSAGES[kind][lang === 'en' ? 'en' : 'bn'];

const makeError = (kind: AssistantErrorKind, lang: AssistantLang): AssistantError =>
  new AssistantError(kind, assistantErrorMessage(kind, lang), kind === 'blocked' ? SAFETY_BLOCK_CODE : undefined);

/** True when the caller cancelled the request (the screen closed). Never show this as an error. */
export const isAssistantAbort = (error: unknown): boolean => {
  const e = error as { name?: string; code?: number; message?: string } | null;
  if (!e) return false;
  if (e.name === 'AbortError' || e.code === 20) return true;
  const message = String(e.message || '').toLowerCase();
  return message === 'aborted' || message.includes('was aborted');
};

// ---------------------------------------------------------------------------
// Request tidying (pure)
// ---------------------------------------------------------------------------

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g;
const tidy = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(CONTROL, ' ').trim().slice(0, max) : '';

const cleanLocation = (value: unknown): { lat: number; lon: number } | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const { lat, lon } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Today's reading with only the known keys and finite numbers. Null (leave the
 * field out) when there is no usable temperature or time.
 */
export const cleanToday = (value: unknown): AssistantToday | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (!finite(v.temp)) return undefined;
  const at = typeof v.readingAt === 'string' ? Date.parse(v.readingAt) : NaN;
  if (!Number.isFinite(at)) return undefined;
  const out: AssistantToday = { readingAt: new Date(at).toISOString(), temp: v.temp };
  if (finite(v.humidity)) out.humidity = v.humidity;
  if (finite(v.windSpeed)) out.windSpeed = v.windSpeed;
  if (finite(v.rainChanceToday)) out.rainChanceToday = v.rainChanceToday;
  if (finite(v.rainChanceNext12h)) out.rainChanceNext12h = v.rainChanceNext12h;
  if (finite(v.soilMoisture)) out.soilMoisture = v.soilMoisture;
  return out;
};

/**
 * The request as it is sent: texts tidied and cut to the limits, history cut to
 * the last 12 turns (empty turns dropped), then the oldest turns dropped until
 * the whole body fits the server's 32 KB (Bangla letters take 3 bytes each).
 * Throws an AssistantError('server') when there is no message to send.
 */
export const buildAssistantRequest = (req: AssistantRequest): AssistantRequest => {
  const lang: AssistantLang = req?.lang === 'en' ? 'en' : 'bn';
  const message = tidy(req?.message, ASK_MESSAGE_MAX);
  if (!message) throw makeError('server', lang);

  const channel = req.channel === 'voice' || req.channel === 'photo' ? req.channel : 'text';
  const out: AssistantRequest = { message, lang, channel };

  const location = cleanLocation(req.location);
  if (location) out.location = location;

  const today = cleanToday(req.today);
  if (today) out.today = today;

  const summary = tidy(req.attachment?.summary, ASK_ATTACHMENT_MAX);
  if (req.attachment?.kind === 'diagnosis' && summary) out.attachment = { kind: 'diagnosis', summary };

  let history: AssistantHistoryTurn[] = [];
  if (Array.isArray(req.history)) {
    for (const turn of req.history) {
      if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) continue;
      const text = tidy(turn.text, ASK_HISTORY_TEXT_MAX);
      if (text) history.push({ role: turn.role, text });
    }
    history = history.slice(-ASK_HISTORY_MAX_TURNS);
  }
  // Drop the oldest turns until the body fits.
  while (history.length > 0 && byteLength(JSON.stringify({ ...out, history })) > ASK_BODY_MAX_BYTES) {
    history = history.slice(1);
  }
  if (history.length > 0) out.history = history;
  return out;
};

// ---------------------------------------------------------------------------
// Response and error mapping (pure)
// ---------------------------------------------------------------------------

/** Turn a failed HTTP answer into the error the screen shows. `body` is the parsed JSON, or null. */
export const mapAssistantHttpError = (status: number, body: unknown, lang: AssistantLang): AssistantError => {
  const b = (body && typeof body === 'object' ? body : {}) as { code?: unknown; limit?: unknown };
  // A safety refusal (the same code as the AI proxy): say so, and do not offer to try again.
  if (isSafetyBlockError(b)) return makeError('blocked', lang);
  if (b.code === 'daily_capacity') return makeError('capacity', lang);
  if (status === 401 || status === 403) return makeError('auth', lang);
  if (status === 429) {
    // A spent daily allowance carries `limit`; any other 429 is the busy service.
    return makeError(b.limit !== undefined ? 'limit' : 'capacity', lang);
  }
  return makeError('server', lang);
};

/** Check an answer from the server. Null when it is not shaped like one. */
export const parseAssistantResponse = (data: unknown): AssistantResponse | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.text !== 'string' || !d.text.trim()) return null;
  const toolCalls: AssistantToolCall[] = [];
  if (Array.isArray(d.toolCalls)) {
    for (const call of d.toolCalls) {
      if (toolCalls.length >= 10) break;
      const c = call as Record<string, unknown> | null;
      if (!c || typeof c.name !== 'string' || !c.name) continue;
      toolCalls.push({ name: c.name, status: c.status === 'failed' ? 'failed' : 'done' });
    }
  }
  const sources: AssistantSource[] = [];
  if (Array.isArray(d.sources)) {
    for (const s of d.sources) {
      if ((ASSISTANT_SOURCES as readonly unknown[]).includes(s) && !sources.includes(s as AssistantSource)) {
        sources.push(s as AssistantSource);
      }
    }
  }
  return { text: d.text.trim(), toolCalls, sources, model: typeof d.model === 'string' ? d.model : '' };
};

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

// One question at a time from this device.
const assistantLimiter = createSlotLimiter(1);

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Ask the assistant. Resolves with the answer; throws an AssistantError
 * (offline, limit, capacity, auth, server, blocked) whose `message` is ready to show in
 * the request's language. A request cancelled through `signal` rejects with the
 * browser's AbortError, which is not an error to show (see isAssistantAbort).
 */
export async function askAssistant(req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResponse> {
  const body = buildAssistantRequest(req);
  const lang = body.lang;
  if (isOffline()) throw makeError('offline', lang);

  const release = await assistantLimiter.acquire(signal);
  try {
    let idToken: string;
    try {
      idToken = await ensureAiSession();
    } catch (error) {
      if (isAssistantAbort(error)) throw error;
      throw makeError(isOffline() ? 'offline' : 'auth', lang);
    }

    let response: Response;
    try {
      response = await fetchWithTimeout('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          // {} unless App Check is configured; never throws or waits more than a few seconds.
          ...(await getAppCheckHeader()),
        },
        body: JSON.stringify(body),
        timeoutMs: ASSISTANT_TIMEOUT_MS,
        retries: 0,
        signal,
      });
    } catch (error) {
      if (isAssistantAbort(error)) throw error;
      // A timeout means the server is slow; any other failure to connect means no network path.
      throw makeError(error instanceof FetchTimeoutError ? 'server' : 'offline', lang);
    }

    if (!response.ok) {
      const info = await response.json().catch(() => null);
      throw mapAssistantHttpError(response.status, info, lang);
    }

    let data: unknown;
    try {
      data = await readJsonWithTimeout<unknown>(response, ASSISTANT_TIMEOUT_MS);
    } catch (error) {
      if (isAssistantAbort(error)) throw error;
      throw makeError('server', lang);
    }
    const answer = parseAssistantResponse(data);
    if (!answer) throw makeError('server', lang);
    return answer;
  } finally {
    release();
  }
}
