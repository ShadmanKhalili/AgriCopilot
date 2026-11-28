import type { Config } from '@netlify/functions';
import {
  enforceIpLimit,
  jsonResponse,
  methodNotAllowed,
  parseIsoDate,
  parseLatLon,
  parseTimezone,
  parseVariableList,
  proxyJson,
} from './_shared/proxy-guard.ts';

/**
 * GET /api/historical-data: Open-Meteo archive (past daily weather), proxied.
 *
 * Strict inputs, allowlisted upstream parameters, no CORS header, and a
 * per-IP limit; a v2 function with its own `path` so the platform rate limit
 * cannot be skipped by calling /.netlify/functions/ directly. The date range
 * is capped so the endpoint cannot be used to ask for decades of data.
 */

const CALLS_PER_IP_PER_MINUTE = 30;
const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const limited = enforceIpLimit(request, 'historical-data', CALLS_PER_IP_PER_MINUTE);
  if (limited) return limited;

  const query = new URL(request.url).searchParams;
  const coords = parseLatLon(query.get('latitude'), query.get('longitude'));
  const startDate = parseIsoDate(query.get('start_date'));
  const endDate = parseIsoDate(query.get('end_date'));
  if (!coords || !startDate || !endDate) {
    return jsonResponse(400, { error: 'Valid latitude, longitude, start_date and end_date are required' });
  }

  const spanDays = (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS;
  if (spanDays < 0 || spanDays > MAX_RANGE_DAYS) {
    return jsonResponse(400, { error: 'Invalid date range' });
  }

  const daily = parseVariableList(query.get('daily'), 20);
  if (daily === null) {
    return jsonResponse(400, { error: 'Invalid climate variables' });
  }

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    start_date: startDate,
    end_date: endDate,
    timezone: parseTimezone(query.get('timezone')),
  });
  if (daily) params.set('daily', daily);

  return proxyJson(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, { timeoutMs: 15_000 });
};

export const config: Config = {
  path: '/api/historical-data',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
