import { Handler } from '@netlify/functions';
import { checkIpRateLimit, extractClientIpFromHeaders } from './_shared/ip-limit.ts';
import {
  getFreshMarketBulletin,
  getStaleMarketBulletin,
  loadMarketBulletin,
  rememberMarketBulletin,
} from './_shared/market-bulletin.ts';

/**
 * Live market prices from the Department of Agricultural Marketing (DAM).
 *
 * ── Why this endpoint exists ───────────────────────────────────────────────
 * The market feature used to ask Gemini to run a Google Search for the
 * daily bulletin. The `googleSearch` tool is refused by this project's key —
 * measured: the upstream rejects the tool and the request is retried without
 * it — so the search returned nothing, the ticker kept its prices frozen at
 * 30 September 2026, and the model, asked for prices it could not look up,
 * was free to invent them.
 *
 * The bulletin is public and free, so the server fetches and parses it:
 *   https://market.dam.gov.bd/market_daily_price_report
 *
 * The parsed bulletin is cached for an hour, because the bulletin itself
 * updates about once a day — every farmer asking for a price must not cause
 * a request to the government site.
 *
 * There is no user-supplied URL here, so this endpoint cannot be used as a
 * proxy for arbitrary destinations; the shared SSRF validator is still used
 * for defence in depth.
 */

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // One address may refresh the bulletin a few times a minute; the cache
  // serves everybody else.
  const ipLimit = checkIpRateLimit(
    extractClientIpFromHeaders(event.headers as Record<string, string | undefined> | undefined),
    20,
    'market-prices'
  );
  if (!ipLimit.allowed) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: 'Too many price refreshes from this connection. Please wait a minute.',
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      }),
    };
  }

  const fresh = getFreshMarketBulletin();
  if (fresh) {
    return { statusCode: 200, headers, body: JSON.stringify({ ...fresh, cached: true }) };
  }

  try {
    const payload = await loadMarketBulletin();
    rememberMarketBulletin(payload);
    return { statusCode: 200, headers, body: JSON.stringify({ ...payload, cached: false }) };
  } catch (error: any) {
    console.warn('[Market Prices] Could not reach the bulletin:', error?.message || error);

    const stale = getStaleMarketBulletin();
    if (stale) {
      return { statusCode: 200, headers, body: JSON.stringify({ ...stale, cached: true }) };
    }

    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'The official price bulletin could not be reached right now. Please try again shortly.',
      }),
    };
  }
};
