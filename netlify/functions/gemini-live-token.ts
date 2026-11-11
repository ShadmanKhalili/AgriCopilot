import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';
import { extractBearerTokenFromHeader, verifyIdToken } from './_shared/auth.ts';
import { checkIpRateLimit, extractClientIpFromHeaders, liveTokensPerIpPerMinute } from './_shared/ip-limit.ts';
import { issueLiveToken } from './_shared/live-token.ts';

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

  try {
    // Each token here starts a billable Live session, so one address must not
    // be able to mint them in a loop.
    const ipLimit = checkIpRateLimit(
      extractClientIpFromHeaders(event.headers as Record<string, string | undefined> | undefined),
      liveTokensPerIpPerMinute(),
      'live-token'
    );
    if (!ipLimit.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: 'Too many live AI sessions from this connection. Please wait a minute and try again.',
          retryAfterSeconds: ipLimit.retryAfterSeconds
        })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in server environment.' })
      };
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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Gemini AuthTokens service is unavailable on the server.' })
      };
    }

    // The client names the Live model it will connect with; the token is
    // locked to it, counted against the daily allowance and time-limited
    // (see `_shared/live-token.ts`).
    let requestedModel: unknown;
    try {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : event.body || '';
      requestedModel = raw ? JSON.parse(raw)?.model : undefined;
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }

    const result = await issueLiveToken(client, user.uid, token, requestedModel, user.isGuest);
    if (result.ok === false) {
      return {
        statusCode: result.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: result.error })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: result.token,
        expireTime: result.expireTime,
        model: result.model
      })
    };
  } catch (err: any) {
    console.error('Failed to generate ephemeral Live API token:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message || 'Failed to generate ephemeral session token.'
      })
    };
  }
};
