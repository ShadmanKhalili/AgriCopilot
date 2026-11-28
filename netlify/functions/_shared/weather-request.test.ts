import { describe, expect, it } from 'vitest';
import {
  normalizeWeatherQuery,
  parseForecastDays,
  serverWeatherKey,
  snapToWeatherGrid,
} from './weather-request.ts';

describe('normalizeWeatherQuery', () => {
  const base = { latitude: '23.8103', longitude: '90.4125' };

  it('snaps coordinates to the 0.05 degree grid', () => {
    const q = normalizeWeatherQuery(base)!;
    expect(q.lat).toBe(23.8);
    expect(q.lon).toBe(90.4);
    expect(q.cacheKey).toBe('23.80_90.40_auto_7');
  });

  it('gives nearby points the same cache key', () => {
    const a = normalizeWeatherQuery({ latitude: '23.81', longitude: '90.41' })!;
    const b = normalizeWeatherQuery({ latitude: '23.789', longitude: '90.424' })!;
    expect(a.cacheKey).toBe(b.cacheKey);
  });

  it('collapses free-form timezone values so they cannot create cache misses', () => {
    const keys = new Set(
      ['x1', 'x2', 'Europe/London', '', undefined, 'auto', '../../etc', 'a'.repeat(500)].map(
        (timezone) => normalizeWeatherQuery({ ...base, timezone })!.cacheKey
      )
    );
    expect([...keys]).toEqual(['23.80_90.40_auto_7']);
    expect(normalizeWeatherQuery({ ...base, timezone: 'Asia/Dhaka' })!.cacheKey).toBe('23.80_90.40_Asia/Dhaka_7');
  });

  it('collapses forecast_days to a whole number from 1 to 16', () => {
    expect(parseForecastDays('3')).toBe(3);
    expect(parseForecastDays('16')).toBe(16);
    for (const bad of ['0', '17', '-1', '7.5', '1e1', 'abc', '', undefined, '007x']) {
      expect(parseForecastDays(bad)).toBe(7);
    }
    const keys = new Set(
      ['q1', 'q2', '999', '8.1'].map((forecast_days) => normalizeWeatherQuery({ ...base, forecast_days })!.cacheKey)
    );
    expect(keys.size).toBe(1);
  });

  it('rejects missing, malformed and out-of-range coordinates', () => {
    for (const input of [
      {},
      { latitude: '23.8' },
      { latitude: 'abc', longitude: '90' },
      { latitude: '91', longitude: '90' },
      { latitude: '23', longitude: '181' },
      { latitude: '1e1', longitude: '90' },
      { latitude: '23,5', longitude: '90' },
      { latitude: '23.8 ', longitude: '90&x=1' },
      { latitude: ['23'], longitude: '90' },
    ]) {
      expect(normalizeWeatherQuery(input as any)).toBeNull();
    }
  });

  it('does not produce negative zero in the key', () => {
    expect(normalizeWeatherQuery({ latitude: '-0.01', longitude: '0' })!.cacheKey).toBe('0.00_0.00_auto_7');
  });
});

describe('snapToWeatherGrid', () => {
  it('stays on two decimals', () => {
    expect(snapToWeatherGrid(23.8103)).toBe(23.8);
    expect(snapToWeatherGrid(90.4999)).toBe(90.5);
    expect(snapToWeatherGrid(-33.27)).toBe(-33.25);
  });
});

describe('serverWeatherKey', () => {
  it('never falls back to the browser-exposed VITE_ key', () => {
    expect(serverWeatherKey({ VITE_GOOGLE_MAPS_API_KEY: 'browser-key' })).toBeUndefined();
  });

  it('prefers the dedicated weather key, then the maps key', () => {
    expect(serverWeatherKey({ GOOGLE_WEATHER_API_KEY: 'w', GOOGLE_MAPS_API_KEY: 'm' })).toBe('w');
    expect(serverWeatherKey({ GOOGLE_MAPS_API_KEY: 'm', VITE_GOOGLE_MAPS_API_KEY: 'v' })).toBe('m');
    expect(serverWeatherKey({ MAPS_API_KEY: 'x' })).toBe('x');
  });

  it('ignores blank values', () => {
    expect(serverWeatherKey({ GOOGLE_WEATHER_API_KEY: '  ', GOOGLE_MAPS_API_KEY: 'm' })).toBe('m');
    expect(serverWeatherKey({})).toBeUndefined();
  });
});
