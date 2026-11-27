import { Handler } from '@netlify/functions';

/**
 * Netlify parity port of GET /api/config-status (server.ts).
 *
 * Reports which provider keys are visible to the server environment so the
 * client can label data sources honestly. Booleans only — no secrets exposed.
 * Routed here by the /api/* catch-all redirect in netlify.toml.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const googleMapsConfigured = Boolean(
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY
  );
  const weatherNextConfigured = Boolean(
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY
  );

  const areaReportsConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      googleMapsConfigured,
      weatherNextConfigured,
      areaReportsConfigured,
      pushConfigured,
      activeProviders: {
        weatherNext: weatherNextConfigured ? 'Google Maps Platform Weather API (live)' : 'Open-Meteo agro-forecast ensemble',
        googleMaps: googleMapsConfigured ? 'Google Maps Platform (Authenticated)' : 'Standard Web Maps'
      }
    })
  };
};
