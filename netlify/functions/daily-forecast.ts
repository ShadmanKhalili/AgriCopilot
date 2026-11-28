import type { Config } from '@netlify/functions';
import {
  enforceIpLimit,
  jsonResponse,
  methodNotAllowed,
  parseLatLon,
  parseTimezone,
  parseVariableList,
  proxyJson,
} from './_shared/proxy-guard.ts';

/**
 * GET /api/daily-forecast: the free Open-Meteo forecast, proxied.
 *
 * Open to signed-out visitors, so the query is parsed strictly and only an
 * explicit allowlist (coordinates, three variable lists, timezone) is sent
 * upstream, built with URLSearchParams. Same-origin only: no CORS header.
 *
 * It is a v2 function with its own `path`, so it is not reachable at
 * /.netlify/functions/daily-forecast, and the platform rate limit below
 * applies to every call. The in-function limiter is the second layer.
 */

const CALLS_PER_IP_PER_MINUTE = 90;

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const limited = enforceIpLimit(request, 'daily-forecast', CALLS_PER_IP_PER_MINUTE);
  if (limited) return limited;

  const query = new URL(request.url).searchParams;
  const coords = parseLatLon(query.get('latitude'), query.get('longitude'));
  if (!coords) {
    return jsonResponse(400, { error: 'Valid latitude and longitude are required' });
  }

  const current = parseVariableList(query.get('current'));
  const hourly = parseVariableList(query.get('hourly'));
  const daily = parseVariableList(query.get('daily'));
  if (current === null || hourly === null || daily === null) {
    return jsonResponse(400, { error: 'Invalid forecast variables' });
  }

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    timezone: parseTimezone(query.get('timezone')),
  });
  if (current) params.set('current', current);
  if (hourly) params.set('hourly', hourly);
  if (daily) params.set('daily', daily);

  return proxyJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { timeoutMs: 10_000 }, {
    // A forecast must never be served stale by a browser or proxy.
    'Cache-Control': 'no-store',
  });
};

export const config: Config = {
  path: '/api/daily-forecast',
  rateLimit: { windowLimit: 90, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
