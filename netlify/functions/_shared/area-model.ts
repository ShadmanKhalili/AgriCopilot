/**
 * Shared shapes and rules for area reports. Pure: no network, no storage,
 * so the browser, the server and the tests all use the same code.
 *
 * What is shared about an area is only ever a count and a date:
 *   - how many different farmers in an upazila reported the same crop
 *     problem in the last 14 days, and
 *   - the sale prices farmers in an upazila said they got.
 * Nothing in a summary says who reported. A warning or a local price is
 * shown only when at least 3 different farmers stand behind it.
 *
 * Firestore layout (all written by the server only):
 *   area_summaries/{areaKey}           readable by signed-in users
 *   area_reporters/{groupKey}__{who}   never readable by the app
 */

/** How far back a report counts. */
export const AREA_WINDOW_DAYS = 14;
/** Fewest different farmers before anything is shown. */
export const AREA_MIN_FARMERS = 3;
/** Most entries kept per problem or crop in a summary. */
export const AREA_MAX_ENTRIES = 60;

/** Sale price a farmer may report, BDT per mon (40 kg). */
export const PRICE_MIN_PER_MON = 100;
export const PRICE_MAX_PER_MON = 100_000;

/** One problem in one area: the last day each different farmer reported it. */
export interface AreaProblem {
  crop: string;
  diseaseKey: string;
  /** One 'YYYY-MM-DD' per different farmer (their latest report). */
  reporterDays: string[];
}

/** One farmer's latest sale price for a crop. No identity. */
export interface AreaPriceReport {
  day: string;
  pricePerMon: number;
}

export interface AreaSummary {
  district: string;
  upazila: string;
  /** Keyed by `problemKey(crop, diseaseKey)`. */
  problems: Record<string, AreaProblem>;
  /** Keyed by crop slug. */
  prices: Record<string, AreaPriceReport[]>;
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

/** Lower-case letters, digits and single underscores only. Empty when nothing is left. */
export const slug = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

/** `pabna__ishwardi`. Null when either part is missing. */
export const areaKey = (district: unknown, upazila: unknown): string | null => {
  const d = slug(district);
  const u = slug(upazila);
  return d && u ? `${d}__${u}` : null;
};

/** `potato__late_blight`. Null when either part is missing. */
export const problemKey = (crop: unknown, diseaseKey: unknown): string | null => {
  const c = slug(crop);
  const k = slug(diseaseKey);
  return c && k ? `${c}__${k}` : null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (value: unknown): value is string => typeof value === 'string' && DAY.test(value);

/** The day `days` before `today`, both 'YYYY-MM-DD'. */
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

/** Problems in this area that enough different farmers reported recently, worst first. */
export const activeWarnings = (summary: AreaSummary | null | undefined, today: string): AreaWarning[] => {
  if (!summary || typeof summary.problems !== 'object' || !summary.problems) return [];
  const warnings: AreaWarning[] = [];
  for (const problem of Object.values(summary.problems)) {
    if (!problem || !Array.isArray(problem.reporterDays)) continue;
    const days = problem.reporterDays.filter((day) => inWindow(day, today));
    if (days.length < AREA_MIN_FARMERS) continue;
    warnings.push({
      crop: String(problem.crop ?? ''),
      diseaseKey: String(problem.diseaseKey ?? ''),
      farmers: days.length,
      lastDay: days.reduce((a, b) => (a > b ? a : b)),
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
  const list = summary?.prices?.[key];
  if (!key || !Array.isArray(list)) return null;
  const recent = list.filter(
    (entry) => entry && inWindow(entry.day, today) && cleanPricePerMon(entry.pricePerMon) !== null
  );
  if (recent.length < AREA_MIN_FARMERS) return null;
  const prices = recent.map((entry) => Math.round(entry.pricePerMon));
  return {
    crop: key,
    avgPerMon: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    lowPerMon: Math.min(...prices),
    highPerMon: Math.max(...prices),
    farmers: recent.length,
    lastDay: recent.map((entry) => entry.day).reduce((a, b) => (a > b ? a : b)),
  };
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

/** Check and tidy a report. Null when anything is missing or not believable. */
export const cleanAreaReport = (input: any): CleanAreaReport | null => {
  if (!input || typeof input !== 'object') return null;
  const area = areaKey(input.district, input.upazila);
  const crop = slug(input.crop);
  if (!area || !crop) return null;
  const base = { areaKey: area, district: label(input.district), upazila: label(input.upazila), crop };
  if (input.kind === 'problem') {
    const key = problemKey(crop, input.diseaseKey);
    if (!key) return null;
    return { ...base, kind: 'problem', diseaseKey: slug(input.diseaseKey), groupKey: `${area}__problem__${key}` };
  }
  if (input.kind === 'price') {
    const price = cleanPricePerMon(input.pricePerMon);
    if (price === null) return null;
    return { ...base, kind: 'price', pricePerMon: price, groupKey: `${area}__price__${crop}` };
  }
  return null;
};

/** The reporters of one group, as stored privately on the server. */
export interface ReporterEntry {
  day: string;
  pricePerMon?: number;
}

/** The summary entry for a problem, built from that group's private reporter list. */
export const problemFromReporters = (report: CleanAreaReport, reporters: ReporterEntry[], today: string): AreaProblem => ({
  crop: report.crop,
  diseaseKey: report.diseaseKey ?? '',
  reporterDays: reporters
    .map((entry) => entry.day)
    .filter((day) => inWindow(day, today))
    .sort()
    .slice(-AREA_MAX_ENTRIES),
});

/** The summary entry for a crop's local prices, built from that group's private reporter list. */
export const pricesFromReporters = (reporters: ReporterEntry[], today: string): AreaPriceReport[] =>
  reporters
    .filter((entry) => inWindow(entry.day, today) && cleanPricePerMon(entry.pricePerMon) !== null)
    .map((entry) => ({ day: entry.day, pricePerMon: Math.round(entry.pricePerMon as number) }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.pricePerMon - b.pricePerMon))
    .slice(-AREA_MAX_ENTRIES);

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
