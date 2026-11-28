import type { Config } from '@netlify/functions';
import {
  enforceIpLimit,
  jsonResponse,
  methodNotAllowed,
  proxyJson,
} from './_shared/proxy-guard.ts';

/**
 * GET /api/wb-indicators?country=BGD&ind=SP.POP.TOTL[&date=2015:2023&per_page=50&page=1&mrv=5]
 *
 * World Bank indicator data, proxied. `country` and `ind` go into the upstream
 * URL path, so each must match a strict pattern; the only other parameters
 * forwarded are `date`, `per_page`, `page` and `mrv`, each validated. Same-origin
 * only, per-IP limited, and a v2 function with its own `path`.
 */

const CALLS_PER_IP_PER_MINUTE = 30;

const COUNTRY = /^[A-Za-z]{2,3}$/;
const INDICATOR = /^[A-Za-z0-9][A-Za-z0-9._]{2,39}$/;
const DATE_RANGE = /^\d{4}(?::\d{4})?$/;

/** A whole number from 1 to `max`, as a string; undefined when absent; null when invalid. */
const boundedInt = (raw: string | null, max: number): string | undefined | null => {
  if (raw === null || raw === '') return undefined;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= max ? String(value) : null;
};

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const limited = enforceIpLimit(request, 'wb-indicators', CALLS_PER_IP_PER_MINUTE);
  if (limited) return limited;

  const query = new URL(request.url).searchParams;
  const country = query.get('country');
  const indicator = query.get('ind');
  if (!country || !indicator || !COUNTRY.test(country) || !INDICATOR.test(indicator)) {
    return jsonResponse(400, { error: 'Invalid country or indicator parameter' });
  }

  const date = query.get('date');
  const perPage = boundedInt(query.get('per_page'), 200);
  const page = boundedInt(query.get('page'), 100);
  const mrv = boundedInt(query.get('mrv'), 50);
  if ((date && !DATE_RANGE.test(date)) || perPage === null || page === null || mrv === null) {
    return jsonResponse(400, { error: 'Invalid query parameter' });
  }

  const params = new URLSearchParams({ format: 'json' });
  if (date) params.set('date', date);
  if (perPage) params.set('per_page', perPage);
  if (page) params.set('page', page);
  if (mrv) params.set('mrv', mrv);

  const url =
    `https://api.worldbank.org/v2/country/${encodeURIComponent(country.toUpperCase())}` +
    `/indicator/${encodeURIComponent(indicator.toUpperCase())}?${params.toString()}`;

  return proxyJson(url, {
    timeoutMs: 15_000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });
};

export const config: Config = {
  path: '/api/wb-indicators',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
