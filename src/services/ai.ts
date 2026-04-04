import { GoogleGenAI, Type, Modality } from '@google/genai';

const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in the environment.");
    // Fallback to a common error that the UI can catch
    throw new Error("AI Service Configuration Error: API Key missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const getModelName = (isAdvanced?: boolean) => isAdvanced ? 'gemma-4-31b' : 'gemma-4-31b';
const BACKUP_MODEL = 'gemini-3.1-flash-lite-preview';
const SEARCH_MODEL = 'gemini-2.5-flash-preview';
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

const callAiWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      // If it's a model not found error or similar, we might want to skip retry and go to fallback if we had one
      // but here we just retry the same function.
      
      if (i === retries - 1) throw error;
      
      const isTransient = error.message?.includes("fetch") || 
                          error.message?.includes("network") || 
                          error.message?.includes("503") || 
                          error.message?.includes("500") ||
                          error.message?.includes("deadline") ||
                          error.message?.includes("quota") ||
                          error.message?.includes("overloaded");
      
      if (!isTransient) throw error;
      
      console.warn(`AI call failed, retrying (${i + 1}/${retries})...`, error);
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
};

const callAiWithFallback = async (params: any, primaryModel: string) => {
  try {
    const ai = getAi();
    return await ai.models.generateContent({ ...params, model: primaryModel });
  } catch (error) {
    console.warn(`Primary model ${primaryModel} failed, falling back to ${BACKUP_MODEL}:`, error);
    const ai = getAi();
    return await ai.models.generateContent({ ...params, model: BACKUP_MODEL });
  }
};

export const diagnoseCrop = async (imageBase64: string, mimeType: string, crop: string, upazila: string, analysisType: string, isAdvanced?: boolean) => {
  return await callAiWithRetry(async () => {
    try {
      const prompt = `You are a Bangladesh DAE agronomist. 
      TASK: Analyze the image for ${analysisType} on a ${crop}.
      
      CRITICAL VALIDATION: 
      1. Look at the image. Does it contain a ${crop}?
      2. If NO, stop immediately and respond ONLY with: 'এই ছবিটি নির্বাচিত ফসলের (${crop}) সাথে মিলছে না। অনুগ্রহ করে সঠিক ফসলের ছবি আপলোড করুন।'
      3. If YES, proceed to analyze the ${analysisType} and recommend a chemical-free or climate-smart solution available locally in Cox's Bazar.
      
      RESPONSE FORMAT: 
      - Respond in Bangla.
      - Keep it under 100 words.`;
      
      const response = await callAiWithFallback({
        contents: [
          { inlineData: { data: imageBase64, mimeType } },
          prompt
        ]
      }, getModelName(isAdvanced));
      
      if (!response.text) {
        throw new Error("AI returned an empty response.");
      }
      
      return response.text;
    } catch (error) {
      console.error("AI Service Error (Diagnose Crop):", error);
      throw error;
    }
  });
};

export const generateSpeech = async (text: string) => {
  return await callAiWithRetry(async () => {
    try {
      const response = await callAiWithFallback({
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }, 'gemini-2.5-flash-preview-tts'); // TTS model is specific, but we use fallback logic
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio;
    } catch (error) {
      console.error("AI Service Error (Generate Speech):", error);
      throw error;
    }
  });
};

export const gradeProduce = async (imageBase64: string, mimeType: string, produce: string, isAdvanced?: boolean) => {
  return await callAiWithRetry(async () => {
    try {
      const prompt = `You are an expert agricultural quality inspector. 
      TASK: Grade this batch of ${produce}.
      
      CRITICAL VALIDATION:
      1. Look at the image. Does it contain ${produce}?
      2. If NO, stop immediately. Set 'grade' to 'Invalid' and 'justification' to a Bangla message explaining that the image does not match the selected produce.
      3. If YES, proceed to grade the batch (Grade A, Grade B, or Reject) based on visual quality, uniformity, and defects.
      
      RESPONSE FORMAT:
      - Respond in JSON format.
      - Justification must be in Bangla.`;
      
      const response = await callAiWithFallback({
        contents: [
          { inlineData: { data: imageBase64, mimeType } },
          prompt
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grade: { type: Type.STRING, description: 'Grade A, Grade B, Reject, or Invalid' },
              justification: { type: Type.STRING, description: 'Short justification for the grade in Bangla' },
              estimatedPriceBdt: { type: Type.NUMBER, description: 'Estimated price per kg in BDT' },
              shelfLife: { type: Type.STRING, description: 'Estimated shelf life (e.g., 3-5 days)' },
              bestMarket: { type: Type.STRING, description: 'Recommended market type (e.g., Local Bazaar, Supermarket, Export)' }
            },
            required: ['grade', 'justification', 'estimatedPriceBdt', 'shelfLife', 'bestMarket']
          }
        }
      }, getModelName(isAdvanced));
      
      if (!response.text) {
        throw new Error("AI returned an empty response.");
      }
      
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("AI Service Error (Grade Produce):", error);
      throw error;
    }
  });
};

export const getMarketInsights = async (produce: string, location: string, lang: string, isAdvanced?: boolean) => {
  return await callAiWithRetry(async () => {
    try {
      const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
      const prompt = `Use Google Search to find the LATEST wholesale market price for ${produce} in ${location}, Bangladesh for TODAY (${today}). Search for official market reports, news articles, or agricultural bulletins from today or the most recent available date. Provide a short market insight including the specific wholesale rate in BDT, the current demand level (High/Medium/Low), and a brief recommendation on whether to sell or hold. Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Do not use markdown formatting.`;
      
      try {
        const response = await callAiWithFallback({
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        }, SEARCH_MODEL);
        return response.text || "No insights could be generated at this time.";
      } catch (searchError) {
        console.warn("Google Search tool failed, falling back to standard generation:", searchError);
        // Fallback without googleSearch
        const fallbackResponse = await callAiWithFallback({
          contents: `Provide a short estimated market insight for ${produce} in ${location}, Bangladesh, including an estimated price range and demand level (High/Medium/Low). Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Do not use markdown formatting.`
        }, BACKUP_MODEL);
        return fallbackResponse.text || "No insights could be generated at this time.";
      }
    } catch (error) {
      console.error("AI Service Error (Market Insights):", error);
      throw error;
    }
  });
};
