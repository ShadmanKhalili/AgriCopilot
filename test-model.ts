import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.models.generateContent({ model: "gemini-3.1-flash-preview", contents: "Hello" });
    console.log("3.1-flash works!");
  } catch(e: any) {
    console.log("3.1-flash failed:", e.message);
  }
}
test();
