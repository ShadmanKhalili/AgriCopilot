import type { Config } from '@netlify/functions';
import {
  enforceIpLimit,
  jsonResponse,
  methodNotAllowed,
  parseLatLon,
  proxyJson,
} from './_shared/proxy-guard.ts';

/**
 * GET /api/loc-lookup: reverse geocoding through BigDataCloud, proxied.
 *
 * Only latitude, longitude and localityLanguage are forwarded (it used to
 * forward every query parameter). Same-origin only, per-IP limited, and a v2
 * function with its own `path` so the platform rate limit always applies.
 */

const CALLS_PER_IP_PER_MINUTE = 60;

/** A two-letter language code, or 'en'. */
const parseLanguage = (raw: string | null): string =>
  raw && /^[a-z]{2}$/.test(raw.toLowerCase()) ? raw.toLowerCase() : 'en';

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const limited = enforceIpLimit(request, 'loc-lookup', CALLS_PER_IP_PER_MINUTE);
  if (limited) return limited;

  const query = new URL(request.url).searchParams;
  const coords = parseLatLon(query.get('latitude'), query.get('longitude'));
  if (!coords) {
    return jsonResponse(400, { error: 'Valid latitude and longitude are required' });
  }

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    localityLanguage: parseLanguage(query.get('localityLanguage')),
  });

  return proxyJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
    { timeoutMs: 8_000 }
  );
};

export const config: Config = {
  path: '/api/loc-lookup',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
