import type { Config } from '@netlify/functions';
import { enforceIpLimit, jsonResponse, methodNotAllowed } from './_shared/proxy-guard.ts';
import { serverWeatherKey } from './_shared/weather-request.ts';

/**
 * Netlify parity port of GET /api/config-status (server.ts).
 *
 * Reports which provider keys are visible to the server environment so the
 * client can label data sources honestly. Booleans only: no secrets exposed.
 * A v2 function with its own `path`, so the platform rate limit always
 * applies; no CORS header.
 */

const CALLS_PER_IP_PER_MINUTE = 60;

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const limited = enforceIpLimit(request, 'config-status', CALLS_PER_IP_PER_MINUTE);
  if (limited) return limited;

  // The live forecast only runs on a server-side key. The map itself loads in
  // the browser with the VITE_ key, so that one still counts for the map.
  const weatherNextConfigured = Boolean(serverWeatherKey());
  const googleMapsConfigured = weatherNextConfigured || Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY);

  const areaReportsConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

  return jsonResponse(
    200,
    {
      googleMapsConfigured,
      weatherNextConfigured,
      areaReportsConfigured,
      pushConfigured,
      activeProviders: {
        weatherNext: weatherNextConfigured ? 'Google Maps Platform Weather API (live)' : 'Open-Meteo agro-forecast ensemble',
        googleMaps: googleMapsConfigured ? 'Google Maps Platform (Authenticated)' : 'Standard Web Maps',
      },
    },
    { 'Cache-Control': 'no-store' }
  );
};

export const config: Config = {
  path: '/api/config-status',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
