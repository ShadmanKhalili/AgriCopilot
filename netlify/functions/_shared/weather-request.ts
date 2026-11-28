import { parseCoordinate, parseTimezone } from './proxy-guard.ts';

/**
 * Normalising a /api/weathernext-3 request.
 *
 * Every live lookup makes three paid Google Weather calls and the endpoint is
 * open to signed-out visitors. The answer is cached per key, so the key must
 * be built only from values with a small, fixed set of possibilities.
 * Otherwise `?timezone=x1`, `?timezone=x2` ... are all cache misses, each one
 * paid. Coordinates snap to the 0.05 degree grid (about 5 km) before they are
 * cached or sent upstream; timezone is 'auto' or 'Asia/Dhaka'; forecast days
 * is a whole number from 1 to 16.
 */

export const WEATHER_GRID_STEP = 0.05;
export const WEATHER_DEFAULT_FORECAST_DAYS = 7;
export const WEATHER_MAX_FORECAST_DAYS = 16;

export interface WeatherQuery {
  /** Latitude snapped to the grid, 2 decimals. */
  lat: number;
  /** Longitude snapped to the grid, 2 decimals. */
  lon: number;
  timezone: 'auto' | 'Asia/Dhaka';
  forecastDays: number;
  cacheKey: string;
}

export const snapToWeatherGrid = (value: number): number =>
  Number((Math.round(value / WEATHER_GRID_STEP) * WEATHER_GRID_STEP).toFixed(2)) + 0;

/** Whole number 1..16, else the default (7). */
export const parseForecastDays = (raw: unknown): number => {
  if (typeof raw !== 'string' || !/^\d{1,2}$/.test(raw.trim())) return WEATHER_DEFAULT_FORECAST_DAYS;
  const days = Number(raw.trim());
  return days >= 1 && days <= WEATHER_MAX_FORECAST_DAYS ? days : WEATHER_DEFAULT_FORECAST_DAYS;
};

/**
 * Null when the coordinates are missing, malformed or out of range;
 * otherwise the normalised query and its cache key.
 */
export const normalizeWeatherQuery = (input: {
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  forecast_days?: unknown;
}): WeatherQuery | null => {
  const rawLat = parseCoordinate(input.latitude, 90);
  const rawLon = parseCoordinate(input.longitude, 180);
  if (rawLat === null || rawLon === null) return null;

  const lat = snapToWeatherGrid(rawLat);
  const lon = snapToWeatherGrid(rawLon);
  const timezone = parseTimezone(input.timezone);
  const forecastDays = parseForecastDays(input.forecast_days);

  return {
    lat,
    lon,
    timezone,
    forecastDays,
    cacheKey: `${lat.toFixed(2)}_${lon.toFixed(2)}_${timezone}_${forecastDays}`,
  };
};

/**
 * The Google Weather API key this server may spend.
 *
 * Server-side variables only. `VITE_GOOGLE_MAPS_API_KEY` is baked into the
 * browser bundle (and meant to be referrer-restricted), so it is never used
 * here. Returns undefined when none is set, which makes the caller serve the
 * free Open-Meteo forecast instead.
 */
export const WEATHER_KEY_ENV_NAMES = [
  'GOOGLE_WEATHER_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'GOOGLE_API_KEY',
  'MAPS_API_KEY',
] as const;

export const serverWeatherKey = (
  env: Record<string, string | undefined> = process.env
): string | undefined => {
  for (const name of WEATHER_KEY_ENV_NAMES) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
};
