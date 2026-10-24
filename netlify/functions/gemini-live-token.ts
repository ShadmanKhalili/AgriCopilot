import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';
import { extractBearerTokenFromHeader, verifyIdToken } from './_shared/auth.ts';
import { checkIpRateLimit, extractClientIpFromHeaders, liveTokensPerIpPerMinute } from './_shared/ip-limit.ts';

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

    // Mint a single-use short-lived ephemeral token for the Live API WebSocket session
    const tokenResponse = await client.authTokens.create({
      config: { uses: 1 }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenResponse.name,
        expireTime: tokenResponse?.expireTime || null
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
