import { describe, expect, it } from 'vitest';
import { DAILY_FIELDS, dateKeyInZone, mergeDailyForecast } from './daily-merge';

const days = (dates: string[], base: number, withEt0 = true) => {
  const d: Record<string, unknown> = { time: dates };
  for (const f of DAILY_FIELDS) {
    if (f === 'et0_fao_evapotranspiration' && !withEt0) continue;
    d[f] = dates.map((_, i) => base + i);
  }
  return d;
};

const week = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07'];

describe('mergeDailyForecast', () => {
  it('keeps the primary days and appends missing dates from the fallback', () => {
    const google = days(week.slice(0, 2), 100, false);
    const om = days(week, 0);
    const { daily, sources } = mergeDailyForecast(google, om);
    expect(daily.time).toEqual(week);
    expect(sources).toEqual(['google', 'google', 'open-meteo', 'open-meteo', 'open-meteo', 'open-meteo', 'open-meteo']);
    expect(daily.temperature_2m_max).toEqual([100, 101, 2, 3, 4, 5, 6]);
    // Google has no et0, so its days are null; later days come from Open-Meteo.
    expect(daily.et0_fao_evapotranspiration).toEqual([null, null, 2, 3, 4, 5, 6]);
  });

  it('keeps every array the same length as time', () => {
    const { daily } = mergeDailyForecast(days(week.slice(0, 1), 50, false), days(week, 0));
    for (const f of DAILY_FIELDS) expect((daily[f] as unknown[]).length).toBe(daily.time.length);
  });

  it('uses null for values the source lacks or are not numbers', () => {
    const om = days(week.slice(0, 3), 0) as any;
    om.precipitation_probability_max = [10, null, 'x'];
    om.uv_index_max = undefined;
    const { daily } = mergeDailyForecast(days(week.slice(0, 1), 9, false), om);
    expect(daily.precipitation_probability_max).toEqual([9, null, null]);
    expect(daily.uv_index_max).toEqual([9, null, null]);
  });

  it('matches by date even when the fallback has a time part', () => {
    const om = days(['2026-07-01T00:00', '2026-07-02T00:00'], 0);
    const { daily, sources } = mergeDailyForecast(days(['2026-07-01'], 100, false), om);
    expect(daily.time).toEqual(['2026-07-01', '2026-07-02']);
    expect(sources).toEqual(['google', 'open-meteo']);
  });

  it('caps at 7 days and sorts by date', () => {
    const { daily } = mergeDailyForecast(days(['2026-07-02'], 100, false), days([...week, '2026-07-08'], 0));
    expect(daily.time).toEqual(week);
  });

  it('returns the primary unchanged when the fallback is missing or empty', () => {
    const google = days(week.slice(0, 2), 100, false) as any;
    for (const bad of [null, undefined, {}, { time: [] }, 'x']) {
      const r = mergeDailyForecast(google, bad);
      expect(r.daily).toBe(google);
      expect(r.sources).toEqual(['google', 'google']);
    }
  });

  it('handles an empty primary', () => {
    const { daily, sources } = mergeDailyForecast({ time: [] }, days(week, 0));
    expect(daily.time).toEqual(week);
    expect(sources.every((s) => s === 'open-meteo')).toBe(true);
  });
});

describe('dateKeyInZone', () => {
  const instant = new Date('2026-07-01T20:00:00Z'); // 02:00 on 2 July in Dhaka
  it('uses Asia/Dhaka for auto and invalid zones', () => {
    expect(dateKeyInZone(instant, 'auto')).toBe('2026-07-02');
    expect(dateKeyInZone(instant, undefined)).toBe('2026-07-02');
    expect(dateKeyInZone(instant, 'Not/AZone')).toBe('2026-07-02');
  });
  it('uses the given zone', () => {
    expect(dateKeyInZone(instant, 'UTC')).toBe('2026-07-01');
  });
});
