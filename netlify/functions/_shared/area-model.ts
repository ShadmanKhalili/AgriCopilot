/**
 * Shared shapes and rules for area reports. Pure: no network, no storage,
 * so the browser, the server and the tests all use the same code.
 *
 * What is shared about an area is only ever an aggregate:
 *   - how many different farmers in an upazila reported the same crop
 *     problem in the last 14 days, and the date of the latest report, and
 *   - for a crop, how many farmers said what they sold it for, and a rounded
 *     average and range of those prices.
 * A group is published only when at least 3 different farmers stand behind
 * it. Nothing in a summary says who reported, and no single farmer's day or
 * price is published.
 *
 * Firestore layout (all written by the server only):
 *   area_raw/{areaKey}                 per-farmer days and prices. NO client access.
 *   area_summaries/{areaKey}           the aggregate above, version 2. Signed-in read.
 *   area_reporters/quota__{who}        a farmer's reports today. NO client access.
 * (Older versions kept a per-farmer document in area_reporters and published
 * per-farmer days in the summary; the client ignores summaries without `version: 2`.)
 */

/** How far back a report counts. */
export const AREA_WINDOW_DAYS = 14;
/** Fewest different farmers before anything is shown. */
export const AREA_MIN_FARMERS = 3;
/** Most farmers kept per problem or crop in the private raw document. */
export const AREA_MAX_REPORTERS_PER_GROUP = 150;
/** Most problems (or crops with prices) kept in one area. */
export const AREA_MAX_GROUPS = 300;
/** Version written into every published summary. */
export const AREA_SUMMARY_VERSION = 2;

/** Sale price a farmer may report, BDT per mon (40 kg). */
export const PRICE_MIN_PER_MON = 100;
export const PRICE_MAX_PER_MON = 100_000;
/** Published prices are rounded: the average to 10 taka, the range outward to 50 taka. */
export const PRICE_AVG_STEP = 10;
export const PRICE_RANGE_STEP = 50;

/** One problem published for an area. Only ever written when `farmers >= AREA_MIN_FARMERS`. */
export interface AreaProblem {
  crop: string;
  diseaseKey: string;
  /** Different farmers who reported it inside the window. */
  farmers: number;
  /** Most recent report day. */
  lastDay: string;
  /** First day the problem no longer has 3 farmers in the window. */
  expiresDay: string;
}

/** The sale prices published for one crop in an area (aggregate only). */
export interface AreaPrice {
  crop: string;
  farmers: number;
  /** Average, rounded to 10 taka per mon. */
  avgPerMon: number;
  /** Lowest price rounded down and highest rounded up to 50 taka per mon. */
  lowPerMon: number;
  highPerMon: number;
  lastDay: string;
  expiresDay: string;
}

/** `area_summaries/{areaKey}`. */
export interface AreaSummary {
  version: number;
  district: string;
  upazila: string;
  /** Keyed by `problemKey(crop, diseaseKey)`. */
  problems: Record<string, AreaProblem>;
  /** Keyed by crop slug. */
  prices: Record<string, AreaPrice>;
  /** Dhaka day ('YYYY-MM-DD') of the last rebuild, never a time. */
  updatedAt: string;
}

export interface AreaWarning {
  crop: string;
  diseaseKey: string;
  /** Different farmers who reported it inside the window. */
  farmers: number;
  /** Most recent report day. */
  lastDay: string;
}

export interface LocalPrice {
  crop: string;
  avgPerMon: number;
  lowPerMon: number;
  highPerMon: number;
  farmers: number;
  lastDay: string;
}

const toSlug = (value: unknown, max: number): string =>
  String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);

/** Lower-case letters, digits and single underscores only. Empty when nothing is left. */
export const slug = (value: unknown): string => toSlug(value, 40);

/** Like `slug` but long enough for a disease key such as `betel-leaf:foot-rot`. */
export const keySlug = (value: unknown): string => toSlug(value, 90);

/** `pabna__ishwardi`. Null when either part is missing. */
export const areaKey = (district: unknown, upazila: unknown): string | null => {
  const d = slug(district);
  const u = slug(upazila);
  return d && u ? `${d}__${u}` : null;
};

/** `potato__potato_late_blight`. Null when either part is missing. */
export const problemKey = (crop: unknown, diseaseKey: unknown): string | null => {
  const c = slug(crop);
  const k = keySlug(diseaseKey);
  return c && k ? `${c}__${k}` : null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (value: unknown): value is string => typeof value === 'string' && DAY.test(value);

/** The day `days` before `today`, both 'YYYY-MM-DD'. A negative `days` gives a later day. */
export const dayBefore = (today: string, days: number): string => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

/** True when `day` is inside the window that ends on `today`. */
export const inWindow = (day: unknown, today: string): boolean =>
  isDay(day) && day <= today && day > dayBefore(today, AREA_WINDOW_DAYS);

/** A sale price a farmer typed, or null when it is not believable. */
export const cleanPricePerMon = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= PRICE_MIN_PER_MON && rounded <= PRICE_MAX_PER_MON ? rounded : null;
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000;

/** True when the published group is still inside its life: first its window, then its expiry day. */
const stillCounts = (group: { lastDay?: unknown; expiresDay?: unknown }, today: string): boolean =>
  inWindow(group.lastDay, today) && isDay(group.expiresDay) && today < group.expiresDay;

/**
 * Problems in this area that enough different farmers reported recently, worst first.
 * The server already publishes only groups of 3 or more; this is a second guard,
 * and it ignores summaries in any older shape.
 */
export const activeWarnings = (summary: AreaSummary | null | undefined, today: string): AreaWarning[] => {
  if (!summary || summary.version !== AREA_SUMMARY_VERSION) return [];
  if (typeof summary.problems !== 'object' || !summary.problems) return [];
  const warnings: AreaWarning[] = [];
  for (const problem of Object.values(summary.problems)) {
    if (!problem || typeof problem !== 'object') continue;
    if (!isCount(problem.farmers) || problem.farmers < AREA_MIN_FARMERS) continue;
    if (!stillCounts(problem, today)) continue;
    warnings.push({
      crop: String(problem.crop ?? ''),
      diseaseKey: String(problem.diseaseKey ?? ''),
      farmers: problem.farmers,
      lastDay: problem.lastDay,
    });
  }
  return warnings.sort((a, b) => b.farmers - a.farmers || (a.lastDay < b.lastDay ? 1 : -1));
};

/** The local sale price for a crop, or null when fewer than 3 farmers reported one recently. */
export const localPrice = (
  summary: AreaSummary | null | undefined,
  crop: unknown,
  today: string
): LocalPrice | null => {
  const key = slug(crop);
  if (!key || !summary || summary.version !== AREA_SUMMARY_VERSION) return null;
  const entry = summary.prices?.[key];
  if (!entry || typeof entry !== 'object') return null;
  if (!isCount(entry.farmers) || entry.farmers < AREA_MIN_FARMERS) return null;
  if (!stillCounts(entry, today)) return null;
  const { avgPerMon, lowPerMon, highPerMon } = entry;
  if ([avgPerMon, lowPerMon, highPerMon].some((n) => typeof n !== 'number' || !Number.isFinite(n) || n <= 0)) return null;
  if (lowPerMon > avgPerMon || avgPerMon > highPerMon) return null;
  return { crop: key, avgPerMon, lowPerMon, highPerMon, farmers: entry.farmers, lastDay: entry.lastDay };
};

/** What the app sends to `/api/area-report`. */
export type AreaReportInput =
  | { kind: 'problem'; district: string; upazila: string; crop: string; diseaseKey: string }
  | { kind: 'price'; district: string; upazila: string; crop: string; pricePerMon: number };

export interface CleanAreaReport {
  kind: 'problem' | 'price';
  areaKey: string;
  district: string;
  upazila: string;
  crop: string;
  /** Set for a problem report. */
  diseaseKey?: string;
  /** Set for a price report. */
  pricePerMon?: number;
  /** `{areaKey}__problem__{problemKey}` or `{areaKey}__price__{crop}`. */
  groupKey: string;
}

const label = (value: unknown): string => String(value ?? '').trim().slice(0, 60);

/**
 * Check the shape of a report and tidy it. Null when anything is missing or not
 * believable. This does NOT check that the place, crop or disease exist: the
 * server does that in area-validate.ts, so the browser does not carry the lists.
 */
export const cleanAreaReport = (input: any): CleanAreaReport | null => {
  if (!input || typeof input !== 'object') return null;
  const area = areaKey(input.district, input.upazila);
  const crop = slug(input.crop);
  if (!area || !crop) return null;
  const base = { areaKey: area, district: label(input.district), upazila: label(input.upazila), crop };
  if (input.kind === 'problem') {
    const key = problemKey(crop, input.diseaseKey);
    if (!key) return null;
    return { ...base, kind: 'problem', diseaseKey: keySlug(input.diseaseKey), groupKey: `${area}__problem__${key}` };
  }
  if (input.kind === 'price') {
    const price = cleanPricePerMon(input.pricePerMon);
    if (price === null) return null;
    return { ...base, kind: 'price', pricePerMon: price, groupKey: `${area}__price__${crop}` };
  }
  return null;
};

// ---------------------------------------------------------------------------
// The private raw data, and how the published summary is built from it.
// ---------------------------------------------------------------------------

/** One farmer's latest report in a group. The farmer is only a hashed code. */
export interface RawReporter {
  day: string;
  pricePerMon?: number;
}

export interface RawProblemGroup {
  crop: string;
  diseaseKey: string;
  /** Keyed by the farmer's anonymous code. */
  reporters: Record<string, RawReporter>;
}

export interface RawPriceGroup {
  crop: string;
  reporters: Record<string, RawReporter>;
}

/** `area_raw/{areaKey}`: everything the server knows, never readable by the app. */
export interface AreaRaw {
  problems: Record<string, RawProblemGroup>;
  prices: Record<string, RawPriceGroup>;
}

export const emptyRaw = (): AreaRaw => ({ problems: {}, prices: {} });

/** The key of the group a report belongs to, inside `problems` or `prices`. */
export const groupKeyIn = (report: CleanAreaReport): string | null =>
  report.kind === 'problem' ? problemKey(report.crop, report.diseaseKey) : slug(report.crop) || null;

/** Keep the newest reporters (by day) and drop those outside the window. */
const freshReporters = (reporters: Record<string, RawReporter>, today: string): Record<string, RawReporter> => {
  const rows = Object.entries(reporters)
    .filter(([, entry]) => entry && inWindow(entry.day, today))
    .sort((a, b) => (a[1].day < b[1].day ? 1 : a[1].day > b[1].day ? -1 : a[0] < b[0] ? -1 : 1))
    .slice(0, AREA_MAX_REPORTERS_PER_GROUP);
  return Object.fromEntries(rows);
};

/** Drop reports older than the window and groups left empty. Does not change `raw`. */
export const pruneRaw = (raw: AreaRaw, today: string): AreaRaw => {
  const out = emptyRaw();
  for (const [key, group] of Object.entries(raw.problems)) {
    const reporters = freshReporters(group.reporters ?? {}, today);
    if (Object.keys(reporters).length > 0) out.problems[key] = { ...group, reporters };
  }
  for (const [key, group] of Object.entries(raw.prices)) {
    const reporters = Object.fromEntries(
      Object.entries(freshReporters(group.reporters ?? {}, today)).filter(
        ([, entry]) => cleanPricePerMon(entry.pricePerMon) !== null
      )
    );
    if (Object.keys(reporters).length > 0) out.prices[key] = { ...group, reporters };
  }
  return out;
};

/** How many different farmers stand behind a report's group inside the window. */
export const farmersInGroup = (raw: AreaRaw, report: CleanAreaReport, today: string): number => {
  const key = groupKeyIn(report);
  if (!key) return 0;
  const group = report.kind === 'problem' ? raw.problems[key] : raw.prices[key];
  if (!group) return 0;
  return Object.values(group.reporters ?? {}).filter(
    (entry) => entry && inWindow(entry.day, today) && (report.kind === 'problem' || cleanPricePerMon(entry.pricePerMon) !== null)
  ).length;
};

/** A copy of `raw` with this farmer's report set (replacing their earlier one in the same group). */
export const withReport = (raw: AreaRaw, report: CleanAreaReport, who: string, today: string): AreaRaw => {
  const key = groupKeyIn(report);
  if (!key) return raw;
  const entry: RawReporter = {
    day: today,
    ...(report.kind === 'price' ? { pricePerMon: report.pricePerMon } : {}),
  };
  if (report.kind === 'problem') {
    const before = raw.problems[key];
    return {
      ...raw,
      problems: {
        ...raw.problems,
        [key]: {
          crop: report.crop,
          diseaseKey: report.diseaseKey ?? '',
          reporters: { ...(before?.reporters ?? {}), [who]: entry },
        },
      },
    };
  }
  const before = raw.prices[key];
  return {
    ...raw,
    prices: { ...raw.prices, [key]: { crop: report.crop, reporters: { ...(before?.reporters ?? {}), [who]: entry } } },
  };
};

/** The day the 3rd newest of these days leaves the window; the group stops counting that day. */
const expiryFor = (days: string[]): string => {
  const sorted = [...days].sort().reverse();
  return dayBefore(sorted[AREA_MIN_FARMERS - 1], -AREA_WINDOW_DAYS);
};

const newest = (days: string[]): string => [...days].sort().reverse()[0];

const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

/**
 * The aggregate that may be published. Only groups with at least
 * `AREA_MIN_FARMERS` different farmers inside the window appear, so a group
 * that has shrunk below that simply disappears the next time this runs.
 */
export const buildPublished = (
  raw: AreaRaw,
  today: string
): { problems: Record<string, AreaProblem>; prices: Record<string, AreaPrice> } => {
  const problems: Record<string, AreaProblem> = {};
  for (const [key, group] of Object.entries(raw.problems)) {
    const days = Object.values(group.reporters ?? {})
      .map((entry) => entry?.day)
      .filter((day) => inWindow(day, today));
    if (days.length < AREA_MIN_FARMERS) continue;
    problems[key] = {
      crop: group.crop,
      diseaseKey: group.diseaseKey,
      farmers: days.length,
      lastDay: newest(days),
      expiresDay: expiryFor(days),
    };
  }

  const prices: Record<string, AreaPrice> = {};
  for (const [key, group] of Object.entries(raw.prices)) {
    const rows = Object.values(group.reporters ?? {}).filter(
      (entry) => entry && inWindow(entry.day, today) && cleanPricePerMon(entry.pricePerMon) !== null
    );
    if (rows.length < AREA_MIN_FARMERS) continue;
    const values = rows.map((entry) => Math.round(entry.pricePerMon as number));
    const days = rows.map((entry) => entry.day);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const clamp = (n: number) => Math.min(PRICE_MAX_PER_MON, Math.max(PRICE_MIN_PER_MON, n));
    const low = clamp(Math.floor(Math.min(...values) / PRICE_RANGE_STEP) * PRICE_RANGE_STEP);
    const high = clamp(Math.ceil(Math.max(...values) / PRICE_RANGE_STEP) * PRICE_RANGE_STEP);
    // Rounding must never put the average outside the published range.
    const avg = Math.min(high, Math.max(low, clamp(roundTo(average, PRICE_AVG_STEP))));
    prices[key] = {
      crop: group.crop,
      farmers: rows.length,
      avgPerMon: avg,
      lowPerMon: low,
      highPerMon: high,
      lastDay: newest(days),
      expiresDay: expiryFor(days),
    };
  }
  return { problems, prices };
};

/** An admin message to farmers, stored in `broadcasts/{id}`. */
export interface Broadcast {
  messageBn: string;
  messageEn: string;
  /** District slug, or 'all'. */
  district: string;
  severity: 'info' | 'warning';
  createdAt: string;
  /** 'YYYY-MM-DD'; the message is hidden after this day. */
  expiresDay: string;
  createdBy: string;
}

/** Broadcasts a farmer in this district should see today, newest first. */
export const activeBroadcasts = <T extends Broadcast>(list: T[], district: unknown, today: string): T[] => {
  const mine = slug(district);
  return list
    .filter((item) => item && isDay(item.expiresDay) && item.expiresDay >= today)
    .filter((item) => item.district === 'all' || (mine !== '' && slug(item.district) === mine))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};
