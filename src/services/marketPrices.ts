/**
 * Live market prices from the Department of Agricultural Marketing (DAM).
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The mandi ticker and the market analysis used to ask Gemini to run a
 * Google Search for the daily bulletin. The `googleSearch` tool is refused
 * by this project's Gemini key — measured: the upstream rejects the tool and
 * the request is retried without it — so the search returned nothing, the
 * ticker kept showing prices frozen at 30 September 2026, and the market
 * answers came from the model's training data. Asked for today's date, the
 * ungrounded model answered "2024-05-18".
 *
 * The bulletin itself is public and free, so the server fetches and parses
 * it (`/api/market-prices`) and this module reads the result. No search
 * engine, no API key, no per-call cost, and the prices are the ones the
 * government actually published.
 *
 * The model still does the work it is good at — explaining those numbers to
 * a farmer in Bangla. It just is no longer asked to find them.
 */

import { fetchWithTimeout, readJsonWithTimeout } from '../utils/fetchWithTimeout';
import { safeStorage } from '../utils/security';

/** One commodity, as published in the bulletin. */
export interface BulletinPrice {
  /** The id the app uses for this commodity. */
  id: string;
  /** English label for the commodity. */
  label: string;
  /** The name exactly as the bulletin prints it (Bangla). */
  name: string;
  /** Lowest published price, BDT. */
  low: number;
  /** Highest published price, BDT. */
  high: number;
  /** Percentage change against the previous day, when published. */
  changePct: number | null;
  /** Which way the price moved. */
  direction: 'up' | 'down' | 'flat';
}

/** The bulletin, as read by the server. */
export interface OfficialBulletin {
  /** Who published the prices. */
  source: string;
  /** Where they came from. */
  sourceUrl: string;
  /** When the bulletin was fetched, ISO 8601. */
  fetchedAt: string;
  /** True when the source could not be reached and a cached copy is being served. */
  stale: boolean;
  /** How many commodities the bulletin carries in total. */
  itemCount: number;
  /** The commodities the app knows about that the bulletin carries. */
  prices: BulletinPrice[];
  /** The commodities the app knows about that the bulletin does not carry. */
  missing: Array<{ id: string; label: string }>;
}

const ENDPOINT = '/api/market-prices';

/**
 * Where the last bulletin that reached this farmer is kept.
 *
 * The government server is not fast, and it sometimes stalls. When it does,
 * the endpoint answers 503 — and without this, the ticker would fall back to
 * the prices frozen in the app's source. Keeping the last bulletin on the
 * device means the farmer keeps seeing the most recent prices they actually
 * received, with the date they were fetched, instead of a month-old
 * constant.
 */
const CACHE_KEY = 'agri.marketBulletin.v1';

/** How old a locally cached bulletin may be before it is not worth showing. */
const LOCAL_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The last bulletin this device received, if it is still recent enough. */
const readCachedBulletin = (): OfficialBulletin | null => {
  const cached = safeStorage.getItem<any>(CACHE_KEY, null);
  if (!cached || !Array.isArray(cached.prices) || !cached.prices.length) return null;
  const fetchedAt = Date.parse(cached.fetchedAt);
  if (Number.isNaN(fetchedAt)) return null;
  if (Date.now() - fetchedAt > LOCAL_CACHE_MAX_AGE_MS) return null;
  return { ...cached, stale: true } as OfficialBulletin;
};

/** Keep the bulletin for next time. */
const writeCachedBulletin = (bulletin: OfficialBulletin): void => {
  try {
    safeStorage.setItem(CACHE_KEY, bulletin);
  } catch {
    // Storage may be unavailable (private mode, quota). Not worth failing over.
  }
};

/**
 * Read the bulletin.
 *
 * Returns `null` when the bulletin cannot be reached — the caller then keeps
 * whatever it already had, which is better than showing nothing.
 */
export const fetchOfficialBulletin = async (signal?: AbortSignal): Promise<OfficialBulletin | null> => {
  try {
    const response = await fetchWithTimeout(ENDPOINT, { signal, timeoutMs: 20000, retries: 1 });
    if (!response.ok) {
      console.warn(`[MarketPrices] bulletin endpoint returned HTTP ${response.status}`);
      return readCachedBulletin();
    }

    const data = await readJsonWithTimeout<any>(response, 20000);
    const matched = Array.isArray(data?.matched) ? data.matched : [];

    const prices: BulletinPrice[] = matched
      .filter((entry: any) => entry?.found && entry?.item)
      .map((entry: any) => ({
        id: String(entry.id),
        label: String(entry.label ?? ''),
        name: String(entry.item?.name ?? ''),
        low: Number(entry.item?.low),
        high: Number(entry.item?.high),
        changePct: typeof entry.item?.changePct === 'number' ? entry.item.changePct : null,
        direction: (entry.item?.direction ?? 'flat') as 'up' | 'down' | 'flat',
      }))
      .filter((price: BulletinPrice) => Number.isFinite(price.low) && Number.isFinite(price.high));

    if (!prices.length) {
      // An empty bulletin is not useful; keep the last good one.
      return readCachedBulletin();
    }

    const bulletin: OfficialBulletin = {
      source: String(data?.source ?? 'Department of Agricultural Marketing (DAM)'),
      sourceUrl: String(data?.sourceUrl ?? 'https://market.dam.gov.bd/market_daily_price_report'),
      fetchedAt: String(data?.fetchedAt ?? new Date().toISOString()),
      stale: Boolean(data?.stale),
      itemCount: Number(data?.itemCount) || prices.length,
      prices,
      missing: Array.isArray(data?.missing) ? data.missing : [],
    };

    writeCachedBulletin(bulletin);
    return bulletin;
  } catch (error) {
    console.warn('[MarketPrices] could not read the official bulletin:', error);
    return readCachedBulletin();
  }
};

/**
 * The bulletin as a block of text for a model prompt.
 *
 * The point is to anchor the model on published numbers instead of letting
 * it invent them: it is told which commodity the prompt is about, what the
 * official figure is, and what to do when the bulletin does not carry that
 * commodity.
 */
export const bulletinPromptContext = (
  bulletin: OfficialBulletin | null,
  produce?: string
): string => {
  if (!bulletin) {
    return [
      'OFFICIAL REFERENCE PRICES: not available right now (the Department of Agricultural',
      'Marketing bulletin could not be reached). Do not state a specific official price;',
      'give a clearly-labelled estimate and say the official bulletin was unavailable.',
    ].join('\n');
  }

  const date = bulletin.fetchedAt.slice(0, 10);
  const lines = bulletin.prices.map(
    (price) =>
      `- ${price.name} (${price.label}): ${price.low} - ${price.high} BDT/kg${
        price.changePct !== null ? ` (change ${price.changePct}%)` : ''
      }`
  );

  const produceNote = produce
    ? [
        '',
        `The commodity asked about is "${produce}".`,
        bulletin.missing.some((entry) => entry.label.toLowerCase().includes(produce.toLowerCase()))
          ? 'It is NOT in today\'s bulletin, so do not present any figure as official.'
          : 'If one of the entries above is that commodity, use it as the authoritative base price and do not contradict it.',
      ].join('\n')
    : '';

  return [
    `OFFICIAL REFERENCE PRICES — Department of Agricultural Marketing (DAM) daily bulletin, fetched ${date}.`,
    `Source: ${bulletin.sourceUrl}`,
    'These are the prices the government published, in BDT per kg. Use them as the base price.',
    ...lines,
    ...(produceNote ? [produceNote] : []),
  ].join('\n');
};
