import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';
import { extractBearerTokenFromHeader, verifyIdToken } from './_shared/auth.ts';
import { checkIpRateLimit, extractClientIpFromHeaders, liveTokensPerIpPerMinute } from './_shared/ip-limit.ts';
import { issueLiveToken, liveTokenMessage } from './_shared/live-token.ts';
import { APP_CHECK_HEADER_NAME, verifyAppCheck } from './_shared/app-check.ts';
import { chargeGlobalAiCall } from './_shared/usage-quota.ts';

/** Raw request bodies above this size are refused. */
const MAX_BODY_CHARS = 16_000;

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

/**
 * Endpoint to issue short-lived ephemeral session tokens for direct browser Live API sessions.
 *
 * Netlify parity port of the Express handler in server.ts (/api/gemini/live-token).
 * The client (src/services/ai.ts -> getEphemeralLiveToken) fetches a single-use token
 * here so the real GEMINI_API_KEY never reaches the browser.
 *
 * Like the AI proxy, this endpoint mints a billable credential, so it only
 * serves a signed-in caller. An anonymous caller could otherwise loop this
 * endpoint to mint as many Live API sessions as they liked.
 *
 * The request carries small validated inputs only (screen, mode, language,
 * place name, farm-memory text). The server builds the system instruction and
 * locks it into the token (see `_shared/live-token.ts`). Errors returned to
 * the caller are generic; details go to the server log.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const token = extractBearerTokenFromHeader(event.headers?.authorization);
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Sign in to use the live AI session.' })
    };
  }
  const user = await verifyIdToken(token);
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Your session has expired. Please sign in again.' })
    };
  }

  let requestBody: any;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    if (raw.length > MAX_BODY_CHARS) {
      return json(413, { code: 'LIVE_BAD_REQUEST', error: liveTokenMessage('LIVE_BAD_REQUEST', 'en') });
    }
    requestBody = raw ? JSON.parse(raw) : {};
  } catch {
    return json(400, { code: 'LIVE_BAD_REQUEST', error: liveTokenMessage('LIVE_BAD_REQUEST', 'en') });
  }
  const lang = requestBody?.lang === 'en' ? 'en' : 'bn';

  try {
    // Each token here starts a billable Live session, so one address must not
    // be able to mint them in a loop.
    const ipLimit = checkIpRateLimit(
      extractClientIpFromHeaders(event.headers as Record<string, string | undefined> | undefined),
      liveTokensPerIpPerMinute(),
      'live-token'
    );
    if (!ipLimit.allowed) {
      return json(429, {
        code: 'LIVE_RATE_LIMITED',
        error:
          lang === 'bn'
            ? 'এই সংযোগ থেকে অনেক লাইভ সেশনের অনুরোধ এসেছে। এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।'
            : 'Too many live AI sessions from this connection. Please wait a minute and try again.',
        retryAfterSeconds: ipLimit.retryAfterSeconds
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[live-token] GEMINI_API_KEY is not configured');
      return json(503, { code: 'LIVE_FAILED', error: liveTokenMessage('LIVE_FAILED', lang) });
    }

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    }) as any;

    if (!client.authTokens?.create) {
      console.error('[live-token] Gemini AuthTokens service is unavailable');
      return json(500, { code: 'LIVE_FAILED', error: liveTokenMessage('LIVE_FAILED', lang) });
    }

    // App Check (off unless APP_CHECK_MODE is set): the same gate as the AI proxy.
    const appCheck = await verifyAppCheck(
      new Request('https://live-token.local/', {
        headers: { [APP_CHECK_HEADER_NAME]: String(event.headers?.[APP_CHECK_HEADER_NAME] || '') },
      })
    );
    if (appCheck.ok === false) {
      return json(401, {
        code: 'app_check',
        error:
          lang === 'bn'
            ? 'অ্যাপটি যাচাই করা যায়নি। পাতাটি আবার খুলে চেষ্টা করুন।'
            : 'The app could not be verified. Please reload the page and try again.',
      });
    }

    // The app-wide daily AI cap (off unless AI_GLOBAL_DAILY_CALL_CAP is set).
    const capacity = await chargeGlobalAiCall('live');
    if (capacity.ok === false) {
      return json(503, {
        code: 'daily_capacity',
        error:
          lang === 'bn'
            ? 'আজকের এআই সীমা শেষ, কাল আবার চেষ্টা করুন।'
            : "The app's AI limit for today is used up, please try again tomorrow.",
      });
    }

    const result = await issueLiveToken(client, user.uid, token, requestBody, user.isGuest);
    if (result.ok === false) {
      return json(result.status, { code: result.code, error: result.error });
    }

    return json(200, {
      token: result.token,
      expireTime: result.expireTime,
      model: result.model
    });
  } catch (err: any) {
    // Details stay in the server log; the caller gets a generic message.
    console.error('Failed to generate ephemeral Live API token:', err);
    return json(500, { code: 'LIVE_FAILED', error: liveTokenMessage('LIVE_FAILED', lang) });
  }
};
