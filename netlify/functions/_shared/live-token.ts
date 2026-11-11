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
 *     rejects messages on the session after the token's `expireTime`.
 *
 * Shared by the Netlify function and the Express dev server.
 */

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

export type LiveTokenResult =
  | { ok: true; token: string; expireTime: string; model: string }
  | { ok: false; status: number; error: string };

/**
 * Check the account's allowance, count the session, and mint a single-use
 * token locked to one Live model. Errors from the Gemini token service are
 * thrown so each caller can keep its own error reporting.
 */
export const issueLiveToken = async (
  client: { authTokens: { create: (params: any) => Promise<any> } },
  uid: string,
  idToken: string,
  requestedModel: unknown,
  isGuest: boolean
): Promise<LiveTokenResult> => {
  const allowed = liveModels();
  const wanted = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (wanted && !allowed.includes(wanted)) {
    return { ok: false, status: 400, error: 'That live model is not available.' };
  }
  const model = wanted || allowed[0];

  const dayNumber = utcDayNumber();
  const plan = await getUserPlan(uid, idToken, isGuest);
  const [used, liveUsed] = await Promise.all([
    countAiUsageToday(uid, idToken, dayNumber),
    countAiUsageToday(uid, idToken, dayNumber, 'live'),
  ]);
  if (used === null || liveUsed === null) {
    return { ok: false, status: 503, error: 'The AI service is busy. Please try again in a moment.' };
  }
  if (used >= dailyAiLimit(plan)) {
    return { ok: false, status: 429, error: dailyLimitMessage(plan) };
  }
  if (liveUsed >= dailyLiveSessionLimit(plan)) {
    return {
      ok: false,
      status: 429,
      error: "You have used all of today's live sessions. Photo diagnosis and chat still work; live video resets tomorrow.",
    };
  }

  // The session is counted before the token exists, so a token is never
  // handed out without a record of it. Until the Firestore rules that accept
  // `live` events are deployed, that write is refused; it is then recorded as
  // `audio`, so the session still counts against the overall allowance.
  const recorded =
    (await recordAiUsage(uid, idToken, dayNumber, 'live')) ||
    (await recordAiUsage(uid, idToken, dayNumber, 'audio'));
  if (!recorded) {
    return { ok: false, status: 503, error: 'The AI service is busy. Please try again in a moment.' };
  }

  const now = Date.now();
  const expireTime = new Date(now + liveSessionMinutes() * 60_000).toISOString();
  const tokenResponse = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
      liveConnectConstraints: { model },
      // An empty list locks only what `liveConnectConstraints` sets (the
      // model). Leaving it out locks every setting to the token's defaults,
      // which would discard the app's own instructions to the model.
      lockAdditionalFields: [],
    },
  });

  return {
    ok: true,
    token: tokenResponse.name,
    expireTime: tokenResponse?.expireTime || expireTime,
    model,
  };
};
