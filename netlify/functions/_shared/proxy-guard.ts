import { checkIpRateLimit, extractClientIp } from './ip-limit.ts';

/**
 * Small, dependency-free helpers shared by the unauthenticated data proxies
 * (forecast, climate history, soil, location lookup, World Bank, satellite).
 *
 * These endpoints take no login, so every value a caller sends is untrusted:
 * it is parsed strictly here and only an explicit allowlist is forwarded
 * upstream, built with URLSearchParams so nothing can add a parameter or
 * change the path.
 *
 * Responses carry no CORS header: the app calls them from its own origin.
 */

export const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/**
 * A coordinate from a query string.
 *
 * Only plain decimal text is accepted ("23.7", "-90.35"): no exponent, no
 * hex, no whitespace tricks, no trailing junk. Null when absent, malformed
 * or beyond `limit` (90 for latitude, 180 for longitude).
 */
export const parseCoordinate = (raw: unknown, limit: number): number | null => {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!/^-?\d{1,3}(?:\.\d{1,20})?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return null;
  return value;
};

/** Like parseCoordinate, but also accepts a JSON number (from a request body). */
export const parseCoordinateInput = (raw: unknown, limit: number): number | null => {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && Math.abs(raw) <= limit ? raw : null;
  }
  return parseCoordinate(raw, limit);
};

/** Round to `decimals` places; never returns -0. */
export const roundCoordinate = (value: number, decimals: number): number =>
  Number(value.toFixed(decimals)) + 0;

/** A validated latitude/longitude pair, rounded; null when either is invalid. */
export const parseLatLon = (
  latRaw: unknown,
  lonRaw: unknown,
  decimals = 3
): { lat: number; lon: number } | null => {
  const lat = parseCoordinate(latRaw, 90);
  const lon = parseCoordinate(lonRaw, 180);
  if (lat === null || lon === null) return null;
  return { lat: roundCoordinate(lat, decimals), lon: roundCoordinate(lon, decimals) };
};

/** Only 'auto' and 'Asia/Dhaka' are ever sent upstream; anything else is 'auto'. */
export const parseTimezone = (raw: unknown): 'auto' | 'Asia/Dhaka' =>
  raw === 'Asia/Dhaka' ? 'Asia/Dhaka' : 'auto';

/**
 * A comma-separated list of Open-Meteo variable names ("temperature_2m,wind_speed_10m").
 * Returns undefined when absent, the cleaned list when valid, and null when
 * any name is malformed or the list is too long.
 */
export const parseVariableList = (
  raw: unknown,
  maxItems = 40
): string | undefined | null => {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || raw.length > 1500) return null;
  const items = raw.split(',');
  if (items.length > maxItems) return null;
  for (const item of items) {
    if (!/^[a-z][a-z0-9_]{1,59}$/.test(item)) return null;
  }
  return items.join(',');
};

/** A real calendar date written YYYY-MM-DD, or null. */
export const parseIsoDate = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const time = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 10) === raw ? raw : null;
};

/**
 * Count one call against the caller's IP. Returns a ready 429 response when
 * the caller is over the limit, or null when the call may go ahead.
 *
 * The counter is per warm function instance (see ip-limit.ts), so it is a
 * floor, not a wall; the platform rate limit in each function's `config`
 * is the other half.
 */
export const enforceIpLimit = (
  request: Request,
  scope: string,
  limitPerMinute: number
): Response | null => {
  const result = checkIpRateLimit(extractClientIp(request), limitPerMinute, scope);
  if (result.allowed) return null;
  return jsonResponse(
    429,
    { error: 'Too many requests. Please wait a minute.', retryAfterSeconds: result.retryAfterSeconds },
    { 'Retry-After': String(result.retryAfterSeconds) }
  );
};

export const methodNotAllowed = (allow: string): Response =>
  jsonResponse(405, { error: 'Method Not Allowed' }, { Allow: allow });

/**
 * GET the upstream URL and pass its JSON through.
 *
 * Any failure (network, timeout, non-2xx, unreadable body) is a generic 502:
 * the upstream's message or status text is never forwarded to the caller.
 */
export const proxyJson = async (
  url: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {},
  extraHeaders: Record<string, string> = {}
): Promise<Response> => {
  try {
    const upstream = await fetch(url, {
      headers: init.headers ?? { Accept: 'application/json' },
      signal: AbortSignal.timeout(init.timeoutMs ?? 12_000),
    });
    if (!upstream.ok) {
      console.warn('[proxy] upstream returned', upstream.status);
      return jsonResponse(502, { error: 'The data service did not respond. Please try again.' });
    }
    const data = await upstream.json();
    return jsonResponse(200, data, extraHeaders);
  } catch (error) {
    console.error('[proxy] upstream request failed:', error instanceof Error ? error.name : 'error');
    return jsonResponse(502, { error: 'The data service did not respond. Please try again.' });
  }
};
