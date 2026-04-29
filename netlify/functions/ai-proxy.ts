import { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on Netlify." }) 
      };
    }

    const { model, contents, config, tools, toolConfig, responseModalities, speechConfig, generationConfig } = JSON.parse(event.body || "{}");
    
    if (!model || !contents) {
      return { statusCode: 400, body: "Missing model or contents" };
    }

    const client = new GoogleGenAI({ apiKey });
    
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        ...(config || {}),
        tools,
        toolConfig,
        responseModalities,
        speechConfig,
        generationConfig
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: response.text,
        candidates: response.candidates,
        promptFeedback: response.promptFeedback
      })
    };
  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};

export { handler };
