import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  const { latitude, longitude, start_date, end_date, daily, timezone } = event.queryStringParameters || {};

  if (!latitude || !longitude || !start_date || !end_date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Latitude, longitude, start_date, and end_date are required" }),
    };
  }

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start_date}&end_date=${end_date}${daily ? `&daily=${daily}` : ""}${timezone ? `&timezone=${timezone}` : "&timezone=auto"}`;

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
    console.error("Historical Weather API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch historical weather data" }),
    };
  }
};
