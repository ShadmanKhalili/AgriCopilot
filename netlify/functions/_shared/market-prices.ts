/**
 * The Department of Agricultural Marketing's daily price bulletin, parsed.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The app used to ask Gemini to "perform an accurate, real-time Google
 * Search" for the daily market bulletin. The `googleSearch` tool is refused
 * by this project's Gemini key (measured: the upstream rejects the tool and
 * the request is retried without it), so the search path returned nothing
 * and the model was left to answer from its training data — it answered
 * 2024-05-18 when asked for today's date.
 *
 * The bulletin itself is public and needs no key, no subscription and no
 * search API, so the server fetches it directly:
 *   https://market.dam.gov.bd/market_daily_price_report
 *
 * ── What the page looks like ───────────────────────────────────────────────
 * The prices are Bangla numerals, in a `name : low - high ▲change%` shape,
 * inside divs rather than a table:
 *
 *   আমন চাল - সরু : ৭২.০০ - ৭৫.০০ ▲0.00%
 *
 * So the parser works on the *text* of the page, not on selectors: a text
 * parser survives the page being restyled, a selector-based one would not.
 */

/** One commodity as published. */
export interface BulletinItem {
  /** The commodity name exactly as the bulletin prints it. */
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

/** Bangla digits (০-৯) to ASCII. */
export const toAsciiDigits = (value: string): string =>
  value.replace(/[\u09E6-\u09EF]/g, (char) => String(char.charCodeAt(0) - 0x09e6));

/**
 * Markers left behind by the anchor tags.
 *
 * Each price is published as
 *   <span class="stockbox"><a href="#name">name</a>: low - high ▲change%</span>
 * so the commodity name is exactly the text inside the anchor. Keeping the
 * anchor boundaries as markers lets the name be cut precisely, instead of
 * guessing where the page's navigation text stops.
 */
const ANCHOR_OPEN = '\u0002';
const ANCHOR_CLOSE = '\u0003';

/**
 * Reduce the page to readable lines.
 *
 * Block-level tags become line breaks so that a commodity name and its
 * prices end up on one line, and the handful of entities the page uses are
 * decoded.
 */
export const bulletinToLines = (html: string): string[] => {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|span|h\d|td|th|option)>/gi, '\n')
    .replace(/<a\b[^>]*>/gi, ANCHOR_OPEN)
    .replace(/<\/a>/gi, ANCHOR_CLOSE)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x25B2;/gi, '▲')
    .replace(/&#x25BC;/gi, '▼')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/gi, '&');

  return text
    .split('\n')
    .map((line) => toAsciiDigits(line).replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
};

/**
 * The commodity name, cut out of the anchors when there are any.
 *
 * Without anchors the name is whatever precedes the numbers.
 */
const extractName = (raw: string): string => {
  const open = raw.lastIndexOf(ANCHOR_OPEN);
  const close = raw.lastIndexOf(ANCHOR_CLOSE);
  if (open !== -1 && close > open) {
    const inside = raw.slice(open + 1, close).trim();
    if (inside) return inside;
  }
  if (open !== -1) {
    const inside = raw.slice(open + 1).trim();
    if (inside) return inside;
  }
  return raw
    .replace(/^[:\-\s]+/, '')
    .replace(new RegExp(`[${ANCHOR_OPEN}${ANCHOR_CLOSE}]`, 'g'), '')
    .trim();
};

/**
 * A price line: a name, then `low - high`, then an optional change.
 *
 * The name may contain a hyphen of its own ("আমন চাল - সরু"), so the name is
 * captured lazily and the numbers anchor the match.
 */
const PRICE_LINE = /^(.{2,80}?)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*-\s*([\d,]+(?:\.\d+)?)\s*([▲▼]?)\s*([\d.]+)%/;

/**
 * Parse the bulletin into structured items.
 *
 * A line that carries only a name is joined with the line after it, because
 * the page splits the name and the price across two elements.
 */
export const parseBulletin = (html: string): BulletinItem[] => {
  const lines = bulletinToLines(html);
  const items: BulletinItem[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];

    // "আমন চাল - সরু" followed by ": ৭২.০০ - ৭৫.০০ ▲0.00%"
    if (!PRICE_LINE.test(line) && index + 1 < lines.length) {
      const next = lines[index + 1];
      if (PRICE_LINE.test(next) && line.length <= 80 && !/\d/.test(line)) {
        line = `${line} ${next}`;
        index += 1;
      }
    }

    const match = PRICE_LINE.exec(line);
    if (!match) continue;

    const [, rawName, rawLow, rawHigh, arrow, rawChange] = match;
    const low = Number(rawLow.replace(/,/g, ''));
    const high = Number(rawHigh.replace(/,/g, ''));
    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
    // A range that runs backwards is a mis-read, not a price.
    if (high < low) continue;

    const name = extractName(rawName);
    if (!name) continue;

    const key = `${name}|${low}-${high}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const changePct = Number(rawChange);
    items.push({
      name,
      low,
      high,
      changePct: Number.isFinite(changePct) ? changePct : null,
      direction: arrow === '▼' ? 'down' : arrow === '▲' ? 'up' : 'flat',
    });
  }

  return items;
};

/**
 * The commodities the app asks about, and how to find each one in the
 * bulletin.
 *
 * The bulletin is a national basket: it carries rice, flour, chicken, beef,
 * eggs, sugar, salt, lentils, soybean oil, onion, garlic, green chilli,
 * ginger and fish — but not tomato, potato or brinjal, which come from the
 * district-level market table. Those three are reported as "not in the
 * bulletin" rather than guessed.
 */
export const COMMODITY_MATCHERS: Array<{
  id: string;
  /** Names in the bulletin that satisfy this commodity. */
  match: string[];
  label: string;
}> = [
  { id: 'pabna_chili', match: ['কাঁচা মরিচ'], label: 'Green Chilli' },
  { id: 'faridpur_onion', match: ['পেঁয়াজ'], label: 'Deshi Onion' },
  { id: 'dinajpur_rice', match: ['বোরো চাল - মোটা', 'মোটা চাল'], label: 'Coarse Rice' },
  { id: 'kushtia_miniket', match: ['বোরো চাল - সরু'], label: 'Fine Rice (Miniket)' },
  { id: 'dhaka_egg', match: ['ডিম'], label: 'Farm Egg' },
  { id: 'natore_garlic', match: ['রসুন - দেশী'], label: 'Deshi Garlic' },
  { id: 'ctg_ginger', match: ['আদা - আমদানিকৃত', 'আদা'], label: 'Ginger' },
  { id: 'dhaka_chicken', match: ['খামারের মুরগী'], label: 'Farm Chicken' },
  { id: 'dhaka_beef', match: ['মাংস'], label: 'Beef' },
  { id: 'sugar', match: ['চিনি'], label: 'Sugar' },
  { id: 'soybean_oil', match: ['সয়াবিন তেল'], label: 'Soybean Oil' },
  { id: 'mug_dal', match: ['মুগ ডাল'], label: 'Mug Dal' },
];

/** Commodities the app wants but the daily bulletin does not carry. */
export const NOT_IN_BULLETIN = [
  { id: 'cb_tomato', label: 'Tomato' },
  { id: 'munshiganj_potato', label: 'Potato' },
  { id: 'jessore_brinjal', label: 'Brinjal' },
];

/**
 * Match the parsed bulletin against the commodities the app asks about.
 *
 * `matched` is false when the bulletin does not carry that commodity, so the
 * caller can show the last known value *labelled as such* instead of
 * pretending it is live.
 */
export const matchCommodities = (items: BulletinItem[]) => {
  const matched: Array<{
    id: string;
    label: string;
    found: boolean;
    item: BulletinItem | null;
  }> = [];

  for (const commodity of COMMODITY_MATCHERS) {
    const item =
      items.find((candidate) =>
        commodity.match.some((needle) => candidate.name.includes(needle))
      ) || null;
    matched.push({
      id: commodity.id,
      label: commodity.label,
      found: !!item,
      item,
    });
  }

  return { matched, missing: NOT_IN_BULLETIN };
};
