/**
 * Fetching and caching the Department of Agricultural Marketing's daily
 * price bulletin.
 *
 * Kept apart from the parser (`market-prices.ts`) on purpose: the parser is
 * pure and can be tested without a network, while this module talks to the
 * outside world through the shared SSRF-validated fetch.
 */

import { safeFetch, readTextWithLimit } from './safe-url.ts';
import { matchCommodities, parseBulletin, type BulletinItem } from './market-prices.ts';

/** The one source this reads. */
export const BULLETIN_URL = 'https://market.dam.gov.bd/market_daily_price_report';

/** How long a parsed bulletin is considered fresh. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** How long a stale bulletin may still be served when the source is down. */
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

/** Ceiling on the response we will buffer from the source. */
const MAX_SOURCE_BYTES = 1024 * 1024;

export interface BulletinPayload {
  source: string;
  sourceUrl: string;
  /** When the bulletin was fetched, ISO 8601. */
  fetchedAt: string;
  /** True when the source could not be reached and a cached copy is served. */
  stale: boolean;
  items: BulletinItem[];
  matched: ReturnType<typeof matchCommodities>['matched'];
  missing: ReturnType<typeof matchCommodities>['missing'];
  itemCount: number;
}

interface CacheEntry {
  payload: BulletinPayload;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

/**
 * Fetch the bulletin and turn it into prices.
 *
 * The bulletin is public: no key, no subscription, no search engine. The
 * source is a government page, so the request is made with a browser-like
 * user agent and goes through the shared SSRF-validated fetch.
 */
export const loadMarketBulletin = async (): Promise<BulletinPayload> => {
  const response = await safeFetch(BULLETIN_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    // The bulletin takes about 3.5 s to answer; the shared default is 8 s,
    // and a little more headroom is worth having on a slow government server.
    // If this budget is exceeded the caller keeps the last known prices.
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Bulletin source returned HTTP ${response.status}`);
  }

  const html = await readTextWithLimit(response, MAX_SOURCE_BYTES);
  const items = parseBulletin(html);
  if (!items.length) {
    throw new Error('Bulletin was fetched but no prices could be read from it');
  }

  const { matched, missing } = matchCommodities(items);

  return {
    source: 'Department of Agricultural Marketing (DAM) — daily market bulletin',
    sourceUrl: BULLETIN_URL,
    fetchedAt: new Date().toISOString(),
    stale: false,
    items,
    matched,
    missing,
    itemCount: items.length,
  };
};

/**
 * The cached bulletin, if it is still recent enough to serve.
 *
 * A stale bulletin is far better than a blank ticker, as long as it is
 * labelled as stale and is not ancient.
 */
export const getStaleMarketBulletin = (): BulletinPayload | null => {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt >= STALE_MAX_MS) return null;
  return { ...cache.payload, stale: true };
};

/**
 * The cached bulletin if it is still fresh (inside the TTL).
 */
export const getFreshMarketBulletin = (): BulletinPayload | null => {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt >= CACHE_TTL_MS) return null;
  return { ...cache.payload };
};

/** Remember a bulletin for the cache window. */
export const rememberMarketBulletin = (payload: BulletinPayload): void => {
  cache = { payload, fetchedAt: Date.now() };
};
