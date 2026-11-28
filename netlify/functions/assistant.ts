import type { Config } from '@netlify/functions';
import { FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { authenticate } from './_shared/auth.ts';
import { verifyAppCheck } from './_shared/app-check.ts';
import { aiCallsPerIpPerMinute, checkIpRateLimit, extractClientIp } from './_shared/ip-limit.ts';
import {
  DAILY_CAPACITY_ERROR,
  chargeGlobalAiCall,
  countAiUsageToday,
  dailyAiLimit,
  dailyLimitMessage,
  getUserPlan,
  recordAiUsage,
  utcDayNumber,
} from './_shared/usage-quota.ts';
import { recordModerationEvent } from './_shared/moderation-events.ts';
import { maxOutputTokensFromEnv } from './_shared/ai-config.ts';
import {
  SAFETY_BLOCK_CODE,
  SAFETY_BLOCK_MESSAGE,
  SERVER_SAFETY_SETTINGS,
  SERVER_SAFETY_SETTINGS_WITHOUT_JAILBREAK,
  detectSafetyBlockInChunk,
  detectSafetyBlockInError,
  isJailbreakCategoryRejection,
} from './_shared/safety-policy.ts';
import { adminFetch } from './_shared/service-account.ts';
import { dhakaDay, formatFarmerContext, loadFarmerFacts } from './_shared/farmer-context.ts';
import {
  ASSISTANT_MODEL,
  buildSystemInstruction,
  messageTopics,
  runAssistantTurn,
  validateAssistantRequest,
  type ChargeOutcome,
  type GenerateFn,
  type GenerateResult,
} from './_shared/assistant-core.ts';
import { TOOL_NAMES, createAssistantTools, quickAnswerFromTools, resolveLocation } from './_shared/assistant-tools.ts';
import {
  getFreshMarketBulletin,
  getStaleMarketBulletin,
  loadMarketBulletin,
  refreshMarketBulletinInBackground,
  rememberMarketBulletin,
  type BulletinPayload,
} from './_shared/market-bulletin.ts';
import { handler as weatherHandler } from './weathernext-3.ts';

/**
 * Phase 9: POST /api/assistant — the farm assistant, talk and read only.
 * Contract: docs/PHASE9_ASSISTANT_SPEC.md. Pure logic: _shared/assistant-core.ts.
 *
 * Same doors as the AI proxy: a Firebase ID token, App Check, a per-IP
 * ceiling, the daily allowance (one `text` unit per turn however many tool
 * rounds it takes, charged right before the first model call) and the
 * app-wide daily cap. The conversation is not stored here.
 */

export const config: Config = {
  path: '/api/assistant',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

/** The model, from AI_ASSISTANT_MODEL when it names a Gemini model. */
const MODEL = /^gemini-[a-z0-9.\-]+$/i.test(process.env.AI_ASSISTANT_MODEL || '')
  ? String(process.env.AI_ASSISTANT_MODEL)
  : ASSISTANT_MODEL;

/**
 * Answers are short; a ceiling also keeps a turn fast. Thinking tokens count
 * against it, so it leaves room for a LOW thinking level plus the answer. An
 * answer cut off at the ceiling (MAX_TOKENS) is replaced by the fixed answer
 * from the tool results when there is one (assistant-core `quickAnswer`).
 */
const MAX_OUTPUT_TOKENS = Math.min(maxOutputTokensFromEnv(), 2048);

/**
 * Gemini 3 models take a thinking level; LOW keeps a tool turn inside the
 * 9 s budget. Older models keep their default. If the upstream rejects the
 * setting, it is dropped for this instance and the call is retried once.
 */
const THINKING_CONFIG = /^gemini-3/i.test(MODEL) ? { thinkingLevel: ThinkingLevel.LOW } : null;
let thinkingConfigDisabledForInstance = false;

const isThinkingConfigRejection = (error: any): boolean => {
  const status = Number(error?.status ?? error?.code);
  const message = String(error?.message || '');
  return (status === 400 || /INVALID_ARGUMENT/i.test(message)) && /thinking/i.test(message);
};

/** The farmer context must leave most of the 9 s for the model and tools. */
const FACTS_TIMEOUT_MS = 2_000;

let jailbreakCategoryDisabledForInstance = false;

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const BUSY = 'The AI service is busy. Please try again in a moment.';

/** Gemini with function calling. Never echoes upstream error text. */
const geminiGenerate = (apiKey: string): GenerateFn => async (req) => {
  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: Math.max(1, req.timeoutMs) } });
  const run = async (): Promise<GenerateResult> => {
    const hasTools = req.tools.length > 0;
    const response = await client.models.generateContent({
      model: MODEL,
      contents: req.contents as any,
      config: {
        systemInstruction: req.systemInstruction,
        temperature: 0.3,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        safetySettings: (jailbreakCategoryDisabledForInstance
          ? SERVER_SAFETY_SETTINGS_WITHOUT_JAILBREAK
          : SERVER_SAFETY_SETTINGS) as any,
        // The declarations stay on the last call too (the history holds
        // function calls); mode NONE is what stops further calls.
        ...(hasTools
          ? {
              tools: [{ functionDeclarations: req.tools as any }],
              toolConfig: {
                functionCallingConfig: {
                  mode: req.toolMode === 'NONE' ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.AUTO,
                },
              },
            }
          : {}),
        ...(THINKING_CONFIG && !thinkingConfigDisabledForInstance ? { thinkingConfig: THINKING_CONFIG } : {}),
        abortSignal: req.signal,
      },
    });
    const block = detectSafetyBlockInChunk(response);
    if (block) {
      return { text: '', functionCalls: [], content: null, blocked: block, model: MODEL };
    }
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    const parts: any[] = Array.isArray(content?.parts) ? content!.parts! : [];
    const functionCalls = parts
      .filter((p) => p?.functionCall?.name)
      .map((p) => ({
        id: typeof p.functionCall.id === 'string' ? p.functionCall.id : undefined,
        name: String(p.functionCall.name),
        args: p.functionCall.args && typeof p.functionCall.args === 'object' ? p.functionCall.args : {},
      }));
    // Thought parts are the model's working, never the answer.
    const text = parts
      .filter((p) => typeof p?.text === 'string' && !p.thought)
      .map((p) => p.text)
      .join('');
    return {
      text,
      functionCalls,
      content: parts.length > 0 ? { role: 'model', parts } : null,
      truncated: String(candidate?.finishReason ?? '') === 'MAX_TOKENS',
      model: MODEL,
    };
  };
  try {
    return await run();
  } catch (error: any) {
    const block = detectSafetyBlockInError(error);
    if (block) return { text: '', functionCalls: [], content: null, blocked: block, model: MODEL };
    if (!jailbreakCategoryDisabledForInstance && isJailbreakCategoryRejection(error)) {
      jailbreakCategoryDisabledForInstance = true;
      console.warn('[Assistant] The upstream rejected HARM_CATEGORY_JAILBREAK; retrying without that one category.');
      return run();
    }
    if (THINKING_CONFIG && !thinkingConfigDisabledForInstance && isThinkingConfigRejection(error)) {
      thinkingConfigDisabledForInstance = true;
      console.warn('[Assistant] The upstream rejected the thinking level; retrying with the model default.');
      return run();
    }
    console.warn('[Assistant] Model call failed:', String(error?.message || error).slice(0, 200));
    throw new Error('model_failed');
  }
};

/**
 * One fetch per point per turn: a prefetch started at the top of the handler
 * and the tools share it. A failed fetch is forgotten so a tool may try again.
 */
const onceByKey = <T,>(load: (key: string) => Promise<T>) => {
  const cache = new Map<string, Promise<T>>();
  return (key: string): Promise<T> => {
    let p = cache.get(key);
    if (!p) {
      p = load(key);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return p;
  };
};

/** The /api/weathernext-3 payload, from the very handler the Home card calls. */
const fetchWeatherFeed = (clientIp: string | null) => async (lat: number, lon: number): Promise<unknown> => {
  const result: any = await weatherHandler(
    {
      httpMethod: 'GET',
      queryStringParameters: { latitude: String(lat), longitude: String(lon), timezone: 'auto' },
      headers: clientIp ? { 'x-real-ip': clientIp } : {},
    } as any,
    {} as any
  );
  if (!result || result.statusCode !== 200 || typeof result.body !== 'string') {
    throw new Error(`weather_${result?.statusCode ?? 'none'}`);
  }
  return JSON.parse(result.body);
};

/** The bulletin as /api/market-prices serves it: fresh cache, else stale (refreshing), else a fetch. */
const getBulletin = async (): Promise<BulletinPayload> => {
  const fresh = getFreshMarketBulletin();
  if (fresh) return fresh;
  const stale = getStaleMarketBulletin();
  if (stale) {
    refreshMarketBulletinInBackground();
    return stale;
  }
  // The fetch keeps going if the tool times out, so the next question finds it cached.
  const loading = loadMarketBulletin().then((payload) => {
    rememberMarketBulletin(payload);
    return payload;
  });
  loading.catch(() => {});
  return loading;
};

export default async (request: Request, _context?: unknown): Promise<Response> => {
  const startedAt = Date.now();
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse(500, { error: 'AI service is not configured.' });

  // 1. Who is asking.
  const { user, reason } = await authenticate(request);
  if (!user) {
    return jsonResponse(401, {
      error: reason === 'missing_token' ? 'Sign in to use the assistant.' : 'Your session has expired. Please sign in again.',
    });
  }
  const appCheck = await verifyAppCheck(request);
  if (!appCheck.ok) return jsonResponse(401, { error: 'app_check' });

  const idToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const clientIp = extractClientIp(request);

  // 2. Per-IP ceiling (shared with the AI proxy's limit).
  const ipLimit = checkIpRateLimit(clientIp, aiCallsPerIpPerMinute(), 'ai-proxy');
  if (!ipLimit.allowed) {
    return jsonResponse(429, {
      error: 'Too many AI requests from this connection. Please wait a minute and try again.',
      code: 'ip_limit',
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    });
  }

  // 3. The body.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse(400, { error: 'Invalid request body.' });
  }
  const checked = validateAssistantRequest(raw, Date.now());
  if (checked.ok === false) return jsonResponse(checked.status, { error: checked.error });
  const req = checked.value;
  const topics = messageTopics(req.message);

  // 4. Today's allowance, before any work.
  const dayNumber = utcDayNumber();
  const plan = await getUserPlan(user.uid, idToken, user.isGuest);
  const limit = dailyAiLimit(plan);
  const used = await countAiUsageToday(user.uid, idToken, dayNumber);
  if (used === null) return jsonResponse(503, { error: BUSY });
  if (used >= limit) return jsonResponse(429, { error: dailyLimitMessage(plan), limit, used });

  // 5. Slow feeds the question will likely need start now, in parallel with
  // the farmer facts, so the first model call does not wait on a cold fetch.
  // The weather feed is skipped when the client sent its own valid reading,
  // unless the question is about later days (the week tool needs the feed).
  const feedFor = onceByKey((key) => {
    const [lat, lon] = key.split(',').map(Number);
    return fetchWeatherFeed(clientIp)(lat, lon);
  });
  const bulletinOnce = onceByKey(() => getBulletin());
  const wantFeed = topics.weather && (!req.today || topics.later);
  const prefetchFeed = (location: { lat: number; lon: number } | null) => {
    if (wantFeed && location) feedFor(`${location.lat},${location.lon}`).catch(() => {});
  };
  if (req.location) prefetchFeed(resolveLocation({ location: req.location, facts: {} }));
  if (topics.market) bulletinOnce('dam').catch(() => {});

  // 6. What the app knows about this farmer (each part unknown when it fails).
  const facts = await loadFarmerFacts(user.uid, { adminFetch, timeoutMs: FACTS_TIMEOUT_MS });
  if (!req.location) prefetchFeed(resolveLocation({ location: null, facts }));
  const today = facts.today ?? dhakaDay(new Date());
  const systemInstruction = buildSystemInstruction({
    lang: req.lang,
    farmerContext: formatFarmerContext(facts, req.lang),
    today,
    toolNames: TOOL_NAMES,
  });

  const tools = createAssistantTools({
    uid: user.uid,
    lang: req.lang,
    facts,
    location: req.location,
    reading: req.today,
    deps: {
      fetchWeatherFeed: (lat, lon) => feedFor(`${lat},${lon}`),
      getBulletin: () => bulletinOnce('dam'),
      adminFetch,
    },
  });

  // One `text` unit and one global call per turn, charged before the first model call.
  const charge = async (): Promise<ChargeOutcome> => {
    const global = await chargeGlobalAiCall('text');
    if (!global.ok) return { ok: false, status: 429, error: DAILY_CAPACITY_ERROR, code: DAILY_CAPACITY_ERROR };
    const reserved = await recordAiUsage(user.uid, idToken, dayNumber, 'text');
    if (!reserved) return { ok: false, status: 503, error: BUSY };
    const usedNow = await countAiUsageToday(user.uid, idToken, dayNumber);
    if (usedNow === null) return { ok: false, status: 503, error: BUSY };
    if (usedNow > limit) return { ok: false, status: 429, error: dailyLimitMessage(plan), limit, used: usedNow };
    return { ok: true };
  };

  const outcome = await runAssistantTurn(req, {
    generate: geminiGenerate(apiKey),
    tools,
    charge,
    systemInstruction,
    startedAt,
    model: MODEL,
    quickAnswer: quickAnswerFromTools,
  });

  switch (outcome.kind) {
    case 'ok':
      return jsonResponse(200, outcome.response);
    case 'charge_failed': {
      const { status, error, code, limit: l, used: u } = outcome.outcome;
      return jsonResponse(status, {
        error,
        ...(code ? { code } : {}),
        ...(l !== undefined ? { limit: l } : {}),
        ...(u !== undefined ? { used: u } : {}),
      });
    }
    case 'blocked':
      // 400 with code SAFETY_BLOCK_CODE ('SAFETY_BLOCK'): the client shows the
      // safety message and must not retry the same text (see the spec).
      await recordModerationEvent(user.uid, idToken, dayNumber, {
        surface: 'text',
        reason: outcome.block.reason,
        category: outcome.block.category,
        model: outcome.model,
        severity: outcome.block.severity,
      });
      return jsonResponse(400, { error: SAFETY_BLOCK_MESSAGE, code: SAFETY_BLOCK_CODE });
    case 'error':
      return jsonResponse(outcome.status, { error: outcome.error });
  }
  return jsonResponse(500, { error: 'Something went wrong.' });
};
