import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

/**
 * Endpoint to issue short-lived ephemeral session tokens for direct browser Live API sessions.
 *
 * Netlify parity port of the Express handler in server.ts (/api/gemini/live-token).
 * The client (src/services/ai.ts -> getEphemeralLiveToken) fetches a single-use token
 * here so the real GEMINI_API_KEY never reaches the browser.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
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
