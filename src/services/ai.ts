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
const SEARCH_MODEL = 'gemini-3-flash-preview';
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
  images: { base64: string; mimeType: string }[], 
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

      const prompt = `You are a world-class agricultural expert specializing in crops from Cox's Bazar, Bangladesh.
      Analyze the provided image(s) of a ${crop} plant from ${upazila} Upazila.
      ${locationContext}
      
      The user is specifically interested in ${analysisType}.
      
      Provide a comprehensive diagnosis in ${lang === 'bn' ? 'Bangla' : 'English'}.
      Your response must be approximately 100 words, detailed, and not generalized.
      
      If multiple images are provided, synthesize the information from all of them to provide a more accurate diagnosis.
      
      CRITICAL: Pay special attention to Nutrient Levels. Farmers rely on this for soil management. 
      Provide specific percentages for Nitrogen (N), Phosphorus (P), and Potassium (K) based on visual symptoms like leaf yellowing (N), purple tints (P), or burnt edges (K).
      
      Return the response in the following JSON format:
      {
        "status": "Valid" | "Invalid",
        "diagnosis": "Detailed markdown diagnosis and treatment plan (approx 100 words)",
        "severity": number (0-100),
        "confidence": number (0-100),
        "verificationAdvice": "Detailed, actionable 2-3 step advice to verify this diagnosis in markdown format (e.g., bullet points for specific field tests or questions for DAE officers).",
        "nutrientLevels": {
          "nitrogen": number (0-100),
          "phosphorus": number (0-100),
          "potassium": number (0-100)
        }
      }
      
      If the image is not related to agriculture or is too blurry, set status to "Invalid" and explain why in the diagnosis field.`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: 'Valid or Invalid' },
            diagnosis: { type: Type.STRING, description: 'Detailed diagnosis text' },
            severity: { type: Type.NUMBER, description: 'Severity percentage' },
            confidence: { type: Type.NUMBER, description: 'Confidence percentage' },
            verificationAdvice: { type: Type.STRING, description: 'Advice for further verification' },
            nutrientLevels: {
              type: Type.OBJECT,
              properties: {
                nitrogen: { type: Type.NUMBER },
                phosphorus: { type: Type.NUMBER },
                potassium: { type: Type.NUMBER }
              }
            }
          },
          required: ['status', 'diagnosis', 'severity', 'confidence', 'verificationAdvice']
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

      const contents: any[] = images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
      contents.push(prompt);

      const response = await callAiWithFallback({
        contents,
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
      const currentYear = new Date().getFullYear();
      const locationContext = coords 
        ? `Precise GPS Location: ${coords.latitude}, ${coords.longitude}.` 
        : `General Location: ${location}, Bangladesh.`;

      const prompt = `Use Google Search to find the LATEST wholesale market price for ${produce} in ${location}, Bangladesh for TODAY (${today}). 
      ${locationContext}
      Search for official market reports, news articles, or agricultural bulletins from ${currentYear}.
      If ${currentYear} data is absolutely unavailable, use data from ${currentYear - 1}.
      
      RESPONSE FORMAT:
      - Respond in JSON format.
      - 'insights': string summary in ${lang === 'bn' ? 'Bangla' : 'English'}.
      - 'priceTrend': array of 7 objects with 'date' (string, format YYYY-MM-DD) and 'price' (number) representing the last 7 days leading up to ${today}.
      - CRITICAL: Ensure the dates in 'priceTrend' are from ${currentYear} (or ${currentYear - 1} if current data is missing). DO NOT use data from 2023 or earlier.
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
                  date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
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
          contents: `Provide a short estimated market insight for ${produce} in ${location}, Bangladesh for the period around ${today}. 
          Return JSON with 'insights' (string) and 'priceTrend' (7 days array leading to ${today}). 
          CRITICAL: Use dates from ${currentYear}.
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
