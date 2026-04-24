import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  const { latitude, longitude, current, hourly, daily, timezone } = event.queryStringParameters || {};

  if (!latitude || !longitude) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Latitude and longitude are required" }),
    };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}${current ? `&current=${current}` : ""}${hourly ? `&hourly=${hourly}` : ""}${daily ? `&daily=${daily}` : ""}${timezone ? `&timezone=${timezone}` : "&timezone=auto"}`;

  try {
    const response = await fetch(url);
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
    console.error("Weather API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch weather data" }),
    };
  }
};
