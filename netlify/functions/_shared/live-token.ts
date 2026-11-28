/**
 * Minting Live API session tokens (live video and live voice).
 *
 * A Live session is the most expensive thing the app does, and the token
 * endpoint used to hand one to any signed-in account behind nothing but a
 * per-IP rate limit: no daily allowance, any Live model, and the default
 * 30-minute lifetime. Every token is now
 *
 *   - counted against the account's daily allowance, and against a separate,
 *     tighter daily count of live sessions;
 *   - locked to the Live model the app asked for, from an allow-list;
 *   - limited to a session of `AI_LIVE_SESSION_MINUTES` (default 15): Gemini
 *     rejects messages on the session after the token's `expireTime`;
 *   - locked to a server-built system instruction, an empty tool list, the
 *     response modality, the voice and context window compression, so the
 *     browser cannot open the WebSocket with its own instructions or tools and
 *     a video session is not cut off after about two minutes. Session
 *     resumption is left unlocked so the browser can pass a resume handle. The
 *     request body carries only small validated inputs (see
 *     `parseLiveTokenRequest`).
 *
 * How the lock works (@google/genai `Tokens.create`): every field set in
 * `liveConnectConstraints.config` becomes part of the token's `fieldMask`
 * (`getFieldMasks`, case "lockAdditionalFields is an empty array" and the
 * non-empty case in `convertBidiSetupToTokenSetup`). Fields named in
 * `lockAdditionalFields` are added to the mask even when they are not set, so
 * `['tools']` locks the tool list to "none". The SDK's `LiveConnectConfig` has
 * no `safetySettings` field, so a Live session has no per-session safety
 * setting to lock; the server-side safety rules travel in the locked system
 * instruction instead (see `live-instructions.ts`).
 *
 * Shared by the Netlify function and the Express dev server.
 */

import { buildLiveSystemInstruction, type LiveKind, type LiveMode } from './live-instructions.ts';
import { liveContextWindowCompression } from './live-session-config.ts';
import {
  countAiUsageToday,
  dailyAiLimit,
  dailyLimitMessage,
  dailyLiveSessionLimit,
  getUserPlan,
  recordAiUsage,
  utcDayNumber,
} from './usage-quota.ts';

/**
 * Live models a token may be locked to (`AI_LIVE_MODELS`, comma-separated).
 * Read on each call: the Express server loads `.env` after its imports run.
 */
export const liveModels = (): string[] => {
  const list = (process.env.AI_LIVE_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => /^gemini-[a-z0-9.\-]+$/i.test(m));
  return list.length
    ? Array.from(new Set(list))
    : ['gemini-3.8-live', 'gemini-3.8-live-extended-thinking'];
};

/** How long one live session may run, in minutes (1–60, default 15). */
const liveSessionMinutes = (): number => {
  const value = Number(process.env.AI_LIVE_SESSION_MINUTES);
  if (!Number.isFinite(value)) return 15;
  return Math.min(60, Math.max(1, Math.trunc(value)));
};

/** A new session must start within this long of the token being minted. */
const NEW_SESSION_WINDOW_MS = 60_000;

export type LiveLang = 'bn' | 'en';
export type LiveThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export const MAX_FARM_CONTEXT_CHARS = 4000;
export const MAX_LOCATION_CHARS = 120;
export const MAX_DIAGNOSIS_CHARS = 400;

export interface LiveTokenRequest {
  kind: LiveKind;
  mode: LiveMode;
  lang: LiveLang;
  thinkingLevel: LiveThinkingLevel;
  locationContext: string;
  diagnosisContext: string;
  farmContext: string;
  /** The model the caller asked for (empty = the first allowed model). */
  model: string;
}

export type LiveTokenResult =
  | { ok: true; token: string; expireTime: string; model: string }
  | { ok: false; status: number; error: string; code: string };

const MESSAGES: Record<string, { en: string; bn: string }> = {
  LIVE_BAD_REQUEST: {
    en: 'The live session request was not valid. Please reload the app and try again.',
    bn: 'লাইভ সেশনের অনুরোধটি সঠিক ছিল না। অ্যাপটি রিলোড করে আবার চেষ্টা করুন।',
  },
  LIVE_MODEL_UNAVAILABLE: {
    en: 'That live model is not available.',
    bn: 'এই লাইভ মডেলটি এখন পাওয়া যাচ্ছে না।',
  },
  LIVE_BUSY: {
    en: 'The AI service is busy. Please try again in a moment.',
    bn: 'এআই সেবা এখন ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  },
  LIVE_SESSIONS_LIMIT: {
    en: "You have used all of today's live sessions. Photo diagnosis and chat still work; live video resets tomorrow.",
    bn: 'আজকের লাইভ সেশনের সীমা শেষ। ছবি দিয়ে রোগ নির্ণয় ও চ্যাট চালু আছে; লাইভ কাল আবার পাবেন।',
  },
  LIVE_FAILED: {
    en: 'Could not start the live session. Please try again.',
    bn: 'লাইভ সেশন শুরু করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
  },
};

/** A friendly, generic message for a live-token error code, in the caller's language. */
export const liveTokenMessage = (code: string, lang: unknown): string => {
  const entry = MESSAGES[code] || MESSAGES.LIVE_FAILED;
  return lang === 'bn' ? entry.bn : entry.en;
};

/** Strip control characters and quote marks, collapse spaces, cap the length. */
const cleanLine = (value: unknown, max: number): string =>
  typeof value === 'string'
    ? value
        .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
        .replace(/["`]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/**
 * Multi-line text from the app (farm memory). Control characters go, blank-line
 * runs collapse, the block markers the instruction uses are removed so the
 * text cannot close its own block, and the length is capped.
 */
const cleanBlock = (value: unknown, max: number): string =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        .replace(/[^\P{Cc}\n\t]/gu, '')
        .replace(/[\p{Zl}\p{Zp}]/gu, '')
        .replace(/(?:BEGIN|END)\s+FARM\s+CONTEXT/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
    : '';

const KINDS: LiveKind[] = ['video', 'voice'];
const MODES: LiveMode[] = ['quick', 'deep'];
const LANGS: LiveLang[] = ['bn', 'en'];
const LEVELS: LiveThinkingLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

export type ParsedLiveTokenRequest =
  | { ok: true; value: LiveTokenRequest }
  | { ok: false; status: number; error: string; code: string };

/**
 * Validate the token request body. Anything outside the allow-lists is
 * rejected; free text is cleaned and capped. No instruction text, tool or
 * safety setting is ever read from the body.
 */
export const parseLiveTokenRequest = (body: unknown): ParsedLiveTokenRequest => {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const lang = input.lang === undefined ? 'bn' : input.lang;
  const bad = (): ParsedLiveTokenRequest => ({
    ok: false,
    status: 400,
    code: 'LIVE_BAD_REQUEST',
    error: liveTokenMessage('LIVE_BAD_REQUEST', lang),
  });

  if (!LANGS.includes(lang as LiveLang)) return bad();
  if (!KINDS.includes(input.kind as LiveKind)) return bad();
  const mode = input.mode === undefined ? 'quick' : input.mode;
  if (!MODES.includes(mode as LiveMode)) return bad();
  const level = input.thinkingLevel === undefined ? 'LOW' : input.thinkingLevel;
  if (!LEVELS.includes(level as LiveThinkingLevel)) return bad();
  if (input.model !== undefined && typeof input.model !== 'string') return bad();

  return {
    ok: true,
    value: {
      kind: input.kind as LiveKind,
      mode: mode as LiveMode,
      lang: lang as LiveLang,
      thinkingLevel: level as LiveThinkingLevel,
      locationContext: cleanLine(input.locationContext, MAX_LOCATION_CHARS) || 'Bangladesh',
      diagnosisContext: cleanLine(input.diagnosisContext, MAX_DIAGNOSIS_CHARS),
      farmContext: cleanBlock(input.farmContext, MAX_FARM_CONTEXT_CHARS),
      model: typeof input.model === 'string' ? input.model.trim() : '',
    },
  };
};

/**
 * The params for `authTokens.create`. Fields set in
 * `liveConnectConstraints.config` are locked: the client cannot change them.
 * `lockAdditionalFields: ['tools']` also locks the tool list while leaving it
 * unset, so the session has no tools.
 *
 * `contextWindowCompression` is locked too, so a session with video is always
 * compressed (otherwise Google ends it after about two minutes). Nothing about
 * `sessionResumption` is set or locked: the browser passes its resume `handle`
 * there when it reconnects, and a locked field would block that.
 * `lockCompression: false` builds the same token without the compression lock;
 * `issueLiveToken` uses it once if Gemini refuses the locked field.
 */
export const buildLiveTokenParams = (
  request: LiveTokenRequest,
  model: string,
  times: { expireTime: string; newSessionExpireTime: string },
  options: { lockCompression?: boolean } = {}
) => {
  const config: Record<string, unknown> = {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: request.lang === 'bn' ? 'Kore' : 'Zephyr' } },
    },
    systemInstruction: buildLiveSystemInstruction({
      kind: request.kind,
      mode: request.mode,
      locationContext: request.locationContext,
      diagnosisContext: request.diagnosisContext,
      farmContext: request.farmContext,
    }),
  };
  if (options.lockCompression !== false) {
    config.contextWindowCompression = liveContextWindowCompression();
  }
  // Only the extended-thinking model accepts a thinking level.
  if (/thinking/i.test(model)) {
    config.thinkingConfig = { thinkingLevel: request.kind === 'voice' ? 'LOW' : request.thinkingLevel };
  }
  return {
    config: {
      uses: 1,
      expireTime: times.expireTime,
      newSessionExpireTime: times.newSessionExpireTime,
      liveConnectConstraints: { model, config },
      lockAdditionalFields: ['tools'],
    },
  };
};

/** True for a Gemini "bad request" (HTTP 400 / INVALID_ARGUMENT) error. */
const isInvalidArgumentError = (err: any): boolean =>
  err?.status === 400 || err?.code === 400 || /INVALID_ARGUMENT|invalid argument|field.?mask/i.test(String(err?.message || ''));

/**
 * Check the account's allowance, count the session, and mint a single-use
 * token locked to one Live model and to a server-built configuration. Errors
 * from the Gemini token service are thrown so each caller can log them and
 * return a generic message.
 */
export const issueLiveToken = async (
  client: { authTokens: { create: (params: any) => Promise<any> } },
  uid: string,
  idToken: string,
  body: unknown,
  isGuest: boolean
): Promise<LiveTokenResult> => {
  const parsed = parseLiveTokenRequest(body);
  if (parsed.ok === false) return parsed;
  const request = parsed.value;
  const lang = request.lang;

  const allowed = liveModels();
  if (request.model && !allowed.includes(request.model)) {
    return { ok: false, status: 400, code: 'LIVE_MODEL_UNAVAILABLE', error: liveTokenMessage('LIVE_MODEL_UNAVAILABLE', lang) };
  }
  const model = request.model || allowed[0];

  const busy = (): LiveTokenResult => ({
    ok: false,
    status: 503,
    code: 'LIVE_BUSY',
    error: liveTokenMessage('LIVE_BUSY', lang),
  });

  const dayNumber = utcDayNumber();
  const plan = await getUserPlan(uid, idToken, isGuest);
  const [used, liveUsed] = await Promise.all([
    countAiUsageToday(uid, idToken, dayNumber),
    countAiUsageToday(uid, idToken, dayNumber, 'live'),
  ]);
  if (used === null || liveUsed === null) return busy();
  if (used >= dailyAiLimit(plan)) {
    return { ok: false, status: 429, code: 'LIVE_DAILY_LIMIT', error: dailyLimitMessage(plan) };
  }
  if (liveUsed >= dailyLiveSessionLimit(plan)) {
    return { ok: false, status: 429, code: 'LIVE_SESSIONS_LIMIT', error: liveTokenMessage('LIVE_SESSIONS_LIMIT', lang) };
  }

  // The session is counted before the token exists, so a token is never
  // handed out without a record of it. Until the Firestore rules that accept
  // `live` events are deployed, that write is refused; it is then recorded as
  // `audio`, so the session still counts against the overall allowance.
  const recorded =
    (await recordAiUsage(uid, idToken, dayNumber, 'live')) ||
    (await recordAiUsage(uid, idToken, dayNumber, 'audio'));
  if (!recorded) return busy();

  const now = Date.now();
  const expireTime = new Date(now + liveSessionMinutes() * 60_000).toISOString();
  const times = {
    expireTime,
    newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
  };
  let tokenResponse: any;
  try {
    tokenResponse = await client.authTokens.create(buildLiveTokenParams(request, model, times));
  } catch (err: any) {
    // The compression lock (a field-mask path) is not covered by Google's
    // token docs. If Gemini rejects the token as invalid, mint it once without
    // that lock rather than leave every Live session broken; the browser still
    // sends the same compression setting itself. Any other failure, and a
    // second failure, propagate as before.
    if (!isInvalidArgumentError(err)) throw err;
    console.warn('[live-token] Gemini refused the locked compression field; minting without that lock.');
    tokenResponse = await client.authTokens.create(
      buildLiveTokenParams(request, model, times, { lockCompression: false })
    );
  }

  return {
    ok: true,
    token: tokenResponse.name,
    expireTime: tokenResponse?.expireTime || expireTime,
    model,
  };
};
