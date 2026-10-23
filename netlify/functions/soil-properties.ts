import { Handler } from "@netlify/functions";

/**
 * Netlify SoilGrids proxy (ISRIC).
 *
 * Two hardening points:
 *  - every upstream call has a timeout, so a stalled ISRIC response cannot
 *    hold a Netlify function open until the platform kills it (which shows up
 *    as a 504 with no explanation);
 *  - the coordinates are validated and the property list is bounded, so the
 *    endpoint cannot be used to ask the upstream for an unbounded response.
 */

const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_PROPERTIES = 8;

const isValidCoordinate = (value: unknown): value is string => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90;
};

export const handler: Handler = async (event) => {
  const { lat, lon, property, depth, value } = event.queryStringParameters || {};

  if (!lat || !lon) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Latitude and longitude are required" }),
    };
  }

  if (!isValidCoordinate(lat) || !isValidCoordinate(lon)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Latitude and longitude must be valid coordinates" }),
    };
  }

  // Handle multiple properties if provided
  const params = new URLSearchParams();
  params.append("lat", lat as string);
  params.append("lon", lon as string);
  
  if (Array.isArray(property)) {
    property.forEach(p => params.append("property", p));
  } else if (property) {
    // If it's a comma separated string or single value
    const props = (property as string).split(',');
    props.forEach(p => params.append("property", p.trim()));
  }

  if (depth) params.append("depth", depth as string);
  if (value) params.append("value", value as string);

  // The ISRIC API uses query parameters for properties like ?property=phh2o&property=nitrogen
  // but queryStringParameters in Netlify might not handle multiple same-key params well if they aren't parsed correctly.
  // Actually, event.queryStringParameters is an object where keys are strings. 
  // If the frontend sends ?property=A&property=B, we might need event.multiValueQueryStringParameters.
  
  const multiParams = event.multiValueQueryStringParameters || {};
  const finalParams = new URLSearchParams();
  finalParams.append("lat", lat as string);
  finalParams.append("lon", lon as string);
  
  const properties = multiParams.property || (property ? [(property as string)] : []);
  properties.slice(0, MAX_PROPERTIES).forEach(p => finalParams.append("property", p));

  const depths = multiParams.depth || (depth ? [(depth as string)] : []);
  depths.slice(0, MAX_PROPERTIES).forEach(d => finalParams.append("depth", d));

  const values = multiParams.value || (value ? [(value as string)] : []);
  values.slice(0, MAX_PROPERTIES).forEach(v => finalParams.append("value", v));

  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?${finalParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Soil data service did not respond" }),
      };
    }
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Soil API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch soil data" }),
    };
  }
};
