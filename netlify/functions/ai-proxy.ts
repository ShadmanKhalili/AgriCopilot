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

    const { model, contents, config, tools, toolConfig, responseModalities, speechConfig } = JSON.parse(event.body || "{}");
    
    if (!model || !contents) {
      return { statusCode: 400, body: "Missing model or contents" };
    }

    const genAI = new GoogleGenAI(apiKey);
    const aiModel = genAI.getGenerativeModel({ model, ...config });

    const result = await aiModel.generateContent({
      contents,
      tools,
      toolConfig,
      responseModalities,
      speechConfig
    });

    const response = await result.response;
    
    // Check if it's an audio response (TTS)
    const candidate = response.candidates?.[0];
    const isAudio = candidate?.content?.parts?.[0]?.inlineData?.data;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response)
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
