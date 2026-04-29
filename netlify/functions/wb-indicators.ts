import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { country, ind } = params;
  
  if (!country || !ind) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing country or indicator parameter" }),
    };
  }

  const otherParams = { ...params };
  delete otherParams.country;
  delete otherParams.ind;
  otherParams.format = 'json';
  
  const searchParams = new URLSearchParams(otherParams as Record<string, string>).toString();
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${ind}?${searchParams}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
        throw new Error(`World Bank API HTTP ${response.status}`);
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
    console.error("World Bank API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to fetch from World Bank API" }),
    };
  }
};
