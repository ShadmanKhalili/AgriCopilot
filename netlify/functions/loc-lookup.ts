import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const searchParams = new URLSearchParams(event.queryStringParameters as Record<string, string> || {}).toString();
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client${searchParams ? `?${searchParams}` : ''}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BigDataCloud API error: ${response.status}`);
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
    console.error("Location Lookup Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to lookup location" }),
    };
  }
};
