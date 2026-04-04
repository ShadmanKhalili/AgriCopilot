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

const getModelName = (isAdvanced?: boolean) => isAdvanced ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';
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

export const diagnoseCrop = async (
  imageBase64: string, 
  mimeType: string, 
  crop: string, 
  upazila: string, 
  analysisType: string, 
  lang: string, 
  isAdvanced?: boolean,
  coords?: { latitude: number; longitude: number }
) => {
  return await callAiWithRetry(async () => {
    try {
      const locationContext = coords 
        ? `Precise GPS Location: ${coords.latitude}, ${coords.longitude}.` 
        : `General Location: ${upazila}, Cox's Bazar.`;

      const prompt = `You are a Bangladesh DAE agronomist. 
      TASK: Analyze the image for ${analysisType} on a ${crop}.
      ${locationContext}
      
      CRITICAL VALIDATION: 
      1. Look at the image. Does it contain a ${crop}?
      2. If NO, stop immediately and respond with 'Invalid' status.
      3. If YES, proceed to analyze the ${analysisType} and recommend a chemical-free or climate-smart solution available locally in Cox's Bazar.
      
      RESPONSE FORMAT: 
      - Respond in JSON format.
      - The 'diagnosis' field should be approximately 100 words, detailed and non-generalized.
      - Include 'severity' (0-100) and 'confidence' (0-100).
      - If it's a nutrient analysis, include 'nutrientLevels' (0-100 for N, P, K).
      - Language: ${lang === 'bn' ? 'Bangla' : 'English'}.
      - Use markdown for formatting inside the 'diagnosis' field.`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: 'Valid or Invalid' },
            diagnosis: { type: Type.STRING, description: 'Detailed diagnosis text' },
            severity: { type: Type.NUMBER, description: 'Severity percentage' },
            confidence: { type: Type.NUMBER, description: 'Confidence percentage' },
            nutrientLevels: {
              type: Type.OBJECT,
              properties: {
                nitrogen: { type: Type.NUMBER },
                phosphorus: { type: Type.NUMBER },
                potassium: { type: Type.NUMBER }
              }
            }
          },
          required: ['status', 'diagnosis', 'severity', 'confidence']
        }
      };
      
      if (coords) {
        config.tools = [{ googleMaps: {} }];
        config.toolConfig = {
          retrievalConfig: {
            latLng: coords
          },
          includeServerSideToolInvocations: true
        };
      }

      const response = await callAiWithFallback({
        contents: [
          { inlineData: { data: imageBase64, mimeType } },
          prompt
        ],
        config
      }, getModelName(isAdvanced));
      
      if (!response.text) {
        throw new Error("AI returned an empty response.");
      }
      
      return JSON.parse(response.text);
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

export const gradeProduce = async (imageBase64: string, mimeType: string, produce: string, lang: string, isAdvanced?: boolean) => {
  return await callAiWithRetry(async () => {
    try {
      const prompt = `You are an expert agricultural quality inspector. 
      TASK: Grade this batch of ${produce}.
      
      CRITICAL VALIDATION:
      1. Look at the image. Does it contain ${produce}?
      2. If NO, stop immediately. Set 'grade' to 'Invalid' and 'justification' to a ${lang === 'bn' ? 'Bangla' : 'English'} message explaining that the image does not match the selected produce.
      3. If YES, proceed to grade the batch (Grade A, Grade B, or Reject) based on visual quality, uniformity, and defects.
      
      RESPONSE FORMAT:
      - Respond in JSON format.
      - Justification must be in ${lang === 'bn' ? 'Bangla' : 'English'}.
      - Use markdown in the justification for better readability.
      - CRITICAL: Keep the justification very short, sweet, and to the point.`;
      
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
              justification: { type: Type.STRING, description: `Short justification for the grade in ${lang === 'bn' ? 'Bangla' : 'English'}` },
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

export const getMarketInsights = async (
  produce: string, 
  location: string, 
  lang: string, 
  isAdvanced?: boolean,
  coords?: { latitude: number; longitude: number }
) => {
  return await callAiWithRetry(async () => {
    try {
      const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
      const locationContext = coords 
        ? `Precise GPS Location: ${coords.latitude}, ${coords.longitude}.` 
        : `General Location: ${location}, Bangladesh.`;

      const prompt = `Use Google Search to find the LATEST wholesale market price for ${produce} in ${location}, Bangladesh for TODAY (${today}). 
      ${locationContext}
      Search for official market reports, news articles, or agricultural bulletins.
      Also use Google Maps to identify the nearest major wholesale markets (Aroths).
      
      RESPONSE FORMAT:
      - Respond in JSON format.
      - 'insights': string summary in ${lang === 'bn' ? 'Bangla' : 'English'}.
      - 'priceTrend': array of 7 objects with 'date' (string) and 'price' (number) representing the last 7 days.
      - 'nearestMarkets': array of objects with 'name' and 'distance'.
      - Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use markdown in 'insights'.`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: { type: Type.STRING },
            priceTrend: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            },
            nearestMarkets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  distance: { type: Type.STRING }
                }
              }
            }
          },
          required: ['insights', 'priceTrend']
        },
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
        toolConfig: {
          includeServerSideToolInvocations: true
        }
      };

      if (coords) {
        config.toolConfig.retrievalConfig = {
          latLng: coords
        };
      }

      try {
        const response = await callAiWithFallback({
          contents: prompt,
          config
        }, SEARCH_MODEL);
        return JSON.parse(response.text || '{}');
      } catch (searchError) {
        console.warn("Google Search tool failed, falling back to standard generation:", searchError);
        // Fallback without googleSearch
        const fallbackResponse = await callAiWithFallback({
          contents: `Provide a short estimated market insight for ${produce} in ${location}, Bangladesh. 
          Return JSON with 'insights' (string) and 'priceTrend' (7 days array). 
          Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: config.responseSchema
          }
        }, BACKUP_MODEL);
        return JSON.parse(fallbackResponse.text || '{}');
      }
    } catch (error) {
      console.error("AI Service Error (Market Insights):", error);
      throw error;
    }
  });
};

export const startAgriChat = (context: string, lang: string) => {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3.1-flash-lite-preview',
    config: {
      systemInstruction: `You are a helpful agricultural expert in Bangladesh. 
      CONTEXT: The user has just received a diagnosis for their crop: "${context}".
      TASK: Answer follow-up questions from the user about this diagnosis. 
      - Provide practical, chemical-free, or climate-smart advice.
      - Use local context for Cox's Bazar, Bangladesh.
      - Respond in ${lang === 'bn' ? 'Bangla' : 'English'}.
      - CRITICAL: Be extremely concise. Keep answers short, sweet, and to the point. 
      - Use markdown for formatting to make it readable.`,
    },
  });
};
