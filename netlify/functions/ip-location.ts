import { Handler } from "@netlify/functions";
import { clientIpFromHeaders } from "./_shared/client-ip.ts";

// Bangladesh territory, same box the Express mirror in server.ts uses.
const BD = { minLat: 20.0, maxLat: 27.0, minLng: 87.5, maxLng: 93.0 };

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const fail = (statusCode: number, error: string) => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify({ error }),
});

/**
 * Approximate location of the *caller*, from their IP address.
 *
 * The caller's IP has to be passed to GeoJS explicitly. A bare
 * `/v1/ip/geo.json` request geolocates whoever made the request, which from
 * a Netlify function is Netlify's data centre, not the farmer.
 */
export const handler: Handler = async (event) => {
  const ip = clientIpFromHeaders(event?.headers as any);
  if (!ip) return fail(400, "Could not determine the client address");

  try {
    const response = await fetch(
      `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!response.ok) throw new Error(`GeoJS status ${response.status}`);
    const data = await response.json();

    const lat = parseFloat(data?.latitude);
    const lon = parseFloat(data?.longitude);
    if (isNaN(lat) || isNaN(lon)) return fail(502, "Location lookup failed");

    const isWithinBangladesh =
      lat >= BD.minLat && lat <= BD.maxLat && lon >= BD.minLng && lon <= BD.maxLng;

    // Outside Bangladesh the client keeps the coordinates out of the farm
    // location (it sees isWithinBangladesh: false and uses its own default).
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        city: data.city,
        region: data.region,
        country: data.country,
        country_code: data.country_code,
        isWithinBangladesh,
      }),
    };
  } catch (error) {
    console.error("IP Location Error:", error);
    return fail(502, "Location lookup failed");
  }
};
