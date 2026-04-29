import { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (!response.ok) {
      throw new Error(`GeoJS API error: ${response.status}`);
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
  } catch (error: any) {
    console.error("IP Location Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to fetch IP location" }),
    };
  }
};
