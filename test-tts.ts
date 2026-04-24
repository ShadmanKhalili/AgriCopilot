import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: "Hello, this is a TTS test.",
      config: {
        responseModalities: ["AUDIO"],
      }
    });
    console.log("Success!", response.candidates?.[0]?.content?.parts?.[0]?.inlineData ? "Has audio data" : "No Audio", response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType);
  } catch (e: any) {
    console.error(e.message || e);
  }
}
run();
