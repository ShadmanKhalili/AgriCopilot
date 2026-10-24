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

/**
 * Budget for one attempt.
 *
 * The government server answers in 3–7 s and is slower under load, so the
 * budget has to be generous; but the whole function has to finish inside
 * Netlify's own limit, so two attempts are bounded rather than open-ended.
 */
const ATTEMPT_TIMEOUT_MS = 9_000;
const RETRY_TIMEOUT_MS = 8_000;

/** Pause before the second attempt. */
const RETRY_DELAY_MS = 700;

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
 * One attempt: fetch the bulletin and turn it into prices.
 */
const fetchBulletinOnce = async (timeoutMs: number): Promise<BulletinPayload> => {
  const response = await safeFetch(BULLETIN_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(timeoutMs),
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
 * Fetch the bulletin, retrying once with a fresh connection.
 *
 * The government server is not fast and sometimes stalls; one retry is the
 * difference between today's prices and yesterday's.
 */
const fetchBulletin = async (): Promise<BulletinPayload> => {
  try {
    return await fetchBulletinOnce(ATTEMPT_TIMEOUT_MS);
  } catch (firstError: any) {
    console.warn('[Market Bulletin] first attempt failed:', firstError?.message || firstError);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return await fetchBulletinOnce(RETRY_TIMEOUT_MS);
  }
};

/** The fetch that is currently running, if any. */
let inFlight: Promise<BulletinPayload> | null = null;

/**
 * Fetch the bulletin — but only one request to the government site at a
 * time.
 *
 * Several farmers opening the app at once must not turn into several
 * simultaneous requests to a government server that is already slow; they
 * all wait for the one fetch and share its answer.
 */
export const loadMarketBulletin = async (): Promise<BulletinPayload> => {
  if (!inFlight) {
    inFlight = fetchBulletin().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
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
