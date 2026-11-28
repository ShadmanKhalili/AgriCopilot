import type { Config } from '@netlify/functions';
import {
  enforceIpLimit,
  jsonResponse,
  methodNotAllowed,
  parseLatLon,
  proxyJson,
} from './_shared/proxy-guard.ts';

/**
 * GET /api/soil-properties: SoilGrids (ISRIC) point query, proxied.
 *
 * Coordinates are validated and rounded; `property`, `depth` and `value` are
 * checked against the lists SoilGrids defines, and nothing else is forwarded.
 * Every upstream call has a timeout, so a stalled ISRIC response cannot hold
 * the function open. Same-origin only, per-IP limited, and a v2 function with
 * its own `path` so the platform rate limit always applies.
 */

const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_PROPERTIES = 8;
const CALLS_PER_IP_PER_MINUTE = 30;

const PROPERTIES = new Set(['bdod', 'cec', 'cfvo', 'clay', 'nitrogen', 'ocd', 'ocs', 'phh2o', 'sand', 'silt', 'soc']);
const DEPTHS = new Set(['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm']);
const VALUES = new Set(['Q0.05', 'Q0.5', 'Q0.95', 'mean', 'uncertainty']);

/**
 * Every value of a repeated (and/or comma-separated) query parameter, kept in
 * order without duplicates. Null when any one is outside the allowlist or
 * there are more than `max`.
 */
const allowedList = (
  query: URLSearchParams,
  name: string,
  allowed: Set<string>,
  max: number
): string[] | null => {
  const out: string[] = [];
  for (const raw of query.getAll(name)) {
    for (const part of raw.split(',')) {
      const item = part.trim();
      if (!item) continue;
      if (!allowed.has(item)) return null;
      if (!out.includes(item)) out.push(item);
    }
  }
  return out.length <= max ? out : null;
};

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const limited = enforceIpLimit(request, 'soil-properties', CALLS_PER_IP_PER_MINUTE);
  if (limited) return limited;

  const query = new URL(request.url).searchParams;
  const coords = parseLatLon(query.get('lat'), query.get('lon'));
  if (!coords) {
    return jsonResponse(400, { error: 'Valid latitude and longitude are required' });
  }

  const properties = allowedList(query, 'property', PROPERTIES, MAX_PROPERTIES);
  const depths = allowedList(query, 'depth', DEPTHS, DEPTHS.size);
  const values = allowedList(query, 'value', VALUES, VALUES.size);
  if (!properties || properties.length === 0 || !depths || !values) {
    return jsonResponse(400, { error: 'Invalid soil property, depth or value' });
  }

  const params = new URLSearchParams();
  params.append('lat', String(coords.lat));
  params.append('lon', String(coords.lon));
  properties.forEach((p) => params.append('property', p));
  depths.forEach((d) => params.append('depth', d));
  values.forEach((v) => params.append('value', v));

  return proxyJson(`https://rest.isric.org/soilgrids/v2.0/properties/query?${params.toString()}`, {
    timeoutMs: UPSTREAM_TIMEOUT_MS,
  });
};

export const config: Config = {
  path: '/api/soil-properties',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
