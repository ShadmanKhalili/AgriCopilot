/**
 * Daily-forecast merge, shared by the Netlify function and server.ts so the two
 * implementations of /api/weathernext-3 cannot drift. Pure TypeScript: no
 * imports, no Node or browser APIs beyond Intl.
 *
 * Google's hourly lookup only covers about 48 hours, so the Google-derived
 * `daily` is 1-2 days long. The 7-day week is completed with Open-Meteo's daily
 * forecast: days Google already has are kept untouched, missing dates are
 * appended from Open-Meteo.
 */

/** The `daily=` parameter for Open-Meteo, identical to the fallback path's. */
export const OPEN_METEO_DAILY_PARAM =
  'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,et0_fao_evapotranspiration';

/** Every array in `daily` besides `time`. */
export const DAILY_FIELDS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'uv_index_max',
  'et0_fao_evapotranspiration',
] as const;

export const MERGED_DAILY_DAYS = 7;

export type DailyBlock = { time: string[] } & Record<string, unknown>;

export interface MergedDaily {
  daily: DailyBlock;
  /** One provider name per entry of `daily.time`, same order. */
  sources: string[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && v.length >= 10;

/**
 * Appends to `primary` the days it lacks from `fallback`, matched by the first
 * 10 characters of the date string.
 *
 * - Days in `primary` are kept exactly as they are (fields the fallback has but
 *   the primary lacks, such as et0, become null for those days).
 * - Result is sorted by date, capped at `maxDays`, and every array has the same
 *   length as `time`. Unknown values are null.
 * - `fallback` null or malformed: `primary` is returned unchanged with every
 *   source set to `primaryName`.
 */
export function mergeDailyForecast(
  primary: unknown,
  fallback: unknown,
  primaryName = 'google',
  fallbackName = 'open-meteo',
  maxDays = MERGED_DAILY_DAYS
): MergedDaily {
  const p = (primary || {}) as Record<string, unknown>;
  const f = (fallback || {}) as Record<string, unknown>;
  const fTimes = Array.isArray(f.time) ? (f.time as unknown[]) : [];

  if (!primary || fTimes.length === 0) {
    const daily = (primary || { time: [] }) as DailyBlock;
    return { daily, sources: (Array.isArray(daily.time) ? daily.time : []).map(() => primaryName) };
  }

  type Row = { date: string; source: string; values: Record<string, number | null> };
  const valueAt = (src: Record<string, unknown>, field: string, i: number): number | null => {
    const col = src[field];
    return Array.isArray(col) && isNum(col[i]) ? (col[i] as number) : null;
  };

  const rows: Row[] = [];
  const seen = new Set<string>();
  const addRows = (src: Record<string, unknown>, times: unknown[], source: string) => {
    times.forEach((t, i) => {
      if (!isDate(t)) return;
      const date = t.slice(0, 10);
      if (seen.has(date)) return;
      seen.add(date);
      const values: Record<string, number | null> = {};
      for (const field of DAILY_FIELDS) values[field] = valueAt(src, field, i);
      rows.push({ date, source, values });
    });
  };
  addRows(p, Array.isArray(p.time) ? (p.time as unknown[]) : [], primaryName);
  addRows(f, fTimes, fallbackName);

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const kept = rows.slice(0, maxDays);

  const daily: DailyBlock = { time: kept.map((r) => r.date) };
  for (const field of DAILY_FIELDS) daily[field] = kept.map((r) => r.values[field]);
  return { daily, sources: kept.map((r) => r.source) };
}

/**
 * 'YYYY-MM-DD' of `date` in the given IANA timezone. 'auto', empty or an
 * invalid zone uses Asia/Dhaka (the app's home timezone).
 */
export function dateKeyInZone(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-CA', {
      ...opts,
      timeZone: timezone && timezone !== 'auto' ? String(timezone) : 'Asia/Dhaka',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'Asia/Dhaka' }).format(date);
  }
}
