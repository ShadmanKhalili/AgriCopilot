import { GoogleGenAI, Type, Modality } from '@google/genai';

export const getAi = () => {
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
const SEARCH_BACKUP_MODEL = 'gemini-2.5-flash-preview';
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
  cropStage: string, 
  analysisType: string, 
  lang: string, 
  isAdvanced?: boolean,
  coords?: { latitude: number; longitude: number }
) => {
  return await callAiWithRetry(async () => {
    try {
      const locationContext = coords 
        ? `Precise GPS Location: ${coords.latitude}, ${coords.longitude}.` 
        : `Location: Unknown (Please advise based on general best practices).`;

      const prompt = `You are a world-class agricultural expert specializing in crops from Bangladesh.
      Analyze the provided image(s) of a ${crop} plant at the ${cropStage} stage.
      ${locationContext}
      
      The user is specifically interested in ${analysisType}.
      
      Provide a comprehensive diagnosis in ${lang === 'bn' ? 'Bangla' : 'English'}.
      Your response must be approximately 100 words, detailed, and not generalized.
      
      If multiple images are provided, synthesize the information from all of them to provide a more accurate diagnosis.
      
      CRITICAL: Pay special attention to Nutrient Levels. Farmers rely on this for soil management. 
      Provide specific percentages for Nitrogen (N), Phosphorus (P), and Potassium (K) based on visual symptoms like leaf yellowing (N), purple tints (P), or burnt edges (K).
      Also, provide the ideal percentage range for these nutrients for this specific crop.
      
      Return the response in the following JSON format:
      {
        "status": "Valid" | "Invalid",
        "diagnosis": "Detailed markdown diagnosis and treatment plan (approx 100 words)",
        "qualitativeSeverity": "Low" | "Medium" | "High",
        "symptomsBreakdown": ["Symptom 1", "Symptom 2", "Symptom 3"],
        "verificationAdvice": "Detailed, actionable 2-3 step advice to verify this diagnosis in markdown format (e.g., bullet points for specific field tests or questions for DAE officers)."
      }
      
      If the image is not related to agriculture or is too blurry, set status to "Invalid" and explain why in the diagnosis field.`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: 'Valid or Invalid' },
            diagnosis: { type: Type.STRING, description: 'Detailed diagnosis text' },
            qualitativeSeverity: { type: Type.STRING, description: 'Low, Medium, or High' },
            symptomsBreakdown: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'List of visible symptoms'
            },
            verificationAdvice: { type: Type.STRING, description: 'Advice for further verification' }
          },
          required: ['status', 'diagnosis', 'qualitativeSeverity', 'symptomsBreakdown', 'verificationAdvice']
        }
      };
      
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

export const translateText = async (text: string, targetLang: string) => {
  return await callAiWithRetry(async () => {
    try {
      const prompt = `Translate the following text to ${targetLang}. Keep the exact same markdown formatting.

Text to translate:
${text}`;

      const response = await callAiWithFallback({
        contents: prompt
      }, BACKUP_MODEL);
      
      return response.text || '';
    } catch (error) {
      console.error("AI Service Error (Translate Text):", error);
      throw error;
    }
  });
};

export const generateWeatherAdvisory = async (
  weatherData: any, 
  lang: string, 
  coords: { latitude: number; longitude: number }
) => {
  return await callAiWithRetry(async () => {
    try {
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      let climateContext = "";
      if (weatherData.historicalAvgTemp) {
        const diff = weatherData.temp - weatherData.historicalAvgTemp;
        const diffText = Math.abs(diff).toFixed(1);
        const direction = diff > 0 ? "hotter" : "cooler";
        climateContext = `Climate Context: This month's historical average temperature over the last 5 years is ${weatherData.historicalAvgTemp.toFixed(1)}°C. Currently, it is ${diffText}°C ${direction} than the historical average.`;
      }

      let historicalTodayContext = "";
      if (weatherData.historicalToday) {
        historicalTodayContext = `Last Year Today's Weather: Max ${weatherData.historicalToday.maxTemp}°C, Min ${weatherData.historicalToday.minTemp}°C, Rain ${weatherData.historicalToday.rain}mm.`;
      }

      let soilContext = "";
      if (weatherData.soilMoisture !== undefined || weatherData.soilPH !== undefined) {
        soilContext = `Soil & Hydrology Context:
        - Soil Moisture (0-7cm): ${weatherData.soilMoisture !== undefined ? weatherData.soilMoisture + ' m³/m³' : 'N/A'}
        - Evapotranspiration: ${weatherData.evapotranspiration !== undefined ? weatherData.evapotranspiration + ' mm/day' : 'N/A'}
        - Soil pH: ${weatherData.soilPH !== undefined ? weatherData.soilPH : 'N/A'}
        - Soil Nitrogen: ${weatherData.soilNitrogen !== undefined ? weatherData.soilNitrogen + ' g/kg' : 'N/A'}
        - Soil Organic Carbon: ${weatherData.soilCarbon !== undefined ? weatherData.soilCarbon + ' g/kg' : 'N/A'}`;
      }

      const prompt = `You are an expert agricultural meteorologist and agronomist in Bangladesh.
      Current Time: ${currentTime}
      Current Weather at GPS (${coords.latitude}, ${coords.longitude}):
      Temp: ${weatherData.temp.toFixed(1)}°C, Condition: ${weatherData.condition}, Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windSpeed}km/h, Rain: ${weatherData.rainfall}mm.
      Safe Spraying Window: ${weatherData.safeSprayingWindow}
      ${climateContext}
      ${historicalTodayContext}
      ${soilContext}
      
      Provide a short, actionable farming advisory in ${lang === 'bn' ? 'Bangla' : 'English'} (approx 80-100 words).
      Focus on:
      - Time of day: Adjust your advice based on the current time (${currentTime}). For example, do not advise spraying in the middle of the night or during peak midday heat.
      - Irrigation needs (use soil moisture and evapotranspiration data if available)
      - Fertilizer/Soil health advice (use soil pH, Nitrogen, Carbon data if available)
      - Pest/Disease risk based on humidity and temperature
      - Sowing/Harvesting timing
      - Use of the Safe Spraying Window for pesticide application.
      
      Use markdown for formatting. Be direct and practical.`;

      const response = await callAiWithFallback({
        contents: prompt
      }, BACKUP_MODEL);
      
      return response.text || '';
    } catch (error) {
      console.error("AI Service Error (Weather Advisory):", error);
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
      }, 'gemini-2.5-flash-preview-tts');
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return null;

      // Gemini TTS returns raw 16-bit PCM at 24000Hz. 
      // We add a WAV header so the browser can play it easily.
      const binary = atob(base64Audio);
      const pcmData = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        pcmData[i] = binary.charCodeAt(i);
      }

      const sampleRate = 24000;
      const buffer = new ArrayBuffer(44 + pcmData.length);
      const view = new DataView(buffer);
      
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + pcmData.length, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, pcmData.length, true);
      new Uint8Array(buffer, 44).set(pcmData);

      // Convert back to base64
      const wavBase64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return wavBase64;
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
  quantity: string, 
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
        : `Location: Unknown (Please advise based on general Bangladesh market trends).`;

      const prompt = `Use Google Search to find the LATEST wholesale market price for ${produce} in Bangladesh for TODAY (${today}). 
      ${locationContext}
      The user wants to sell a quantity of ${quantity} kg.
      Search for official market reports, news articles, or agricultural bulletins from ${currentYear}.
      If ${currentYear} data is absolutely unavailable, use data from ${currentYear - 1}.
      
      CRITICAL: All prices must be in BDT (Taka) and per KG (Kilogram). If you find prices in Maunds (40kg), convert them to per KG.
      
      RESPONSE FORMAT:
      - Respond in JSON format.
      - 'insights': string summary in ${lang === 'bn' ? 'Bangla' : 'English'}.
      - 'priceDrivers': array of 3-5 strings explaining the key factors currently affecting the price of this produce (e.g., "Recent heavy rains in northern districts", "High transport costs").
      - 'nearestMarkets': array of objects with 'name' and 'distance'.
      - Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Use markdown in 'insights'.`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: { type: Type.STRING },
            priceDrivers: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
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
          required: ['insights', 'priceDrivers']
        },
        tools: [{ googleSearch: {} }],
        toolConfig: {
          includeServerSideToolInvocations: true
        }
      };

      try {
        // Try primary search model (Gemini 3)
        try {
          const response = await callAiWithFallback({
            contents: prompt,
            config
          }, SEARCH_MODEL);
          return JSON.parse(response.text || '{}');
        } catch (primarySearchError) {
          console.warn(`Primary search model ${SEARCH_MODEL} failed, trying ${SEARCH_BACKUP_MODEL}:`, primarySearchError);
          // Try backup search model (Gemini 2.5)
          const response = await callAiWithFallback({
            contents: prompt,
            config
          }, SEARCH_BACKUP_MODEL);
          return JSON.parse(response.text || '{}');
        }
      } catch (searchError) {
        console.warn("Both Google Search models failed, falling back to standard generation:", searchError);
        // Fallback without googleSearch
        const fallbackResponse = await callAiWithFallback({
          contents: `Provide a short estimated market insight for ${produce} in ${location}, Bangladesh for the period around ${today}. 
          Return JSON with 'insights' (string) and 'priceDrivers' (array of strings). 
          CRITICAL: All prices must be in BDT and per KG.
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

export const findGovernmentSchemes = async (
  location: string, 
  crop: string, 
  lang: string
) => {
  return await callAiWithRetry(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const prompt = `Use Google Search to find the LATEST agricultural subsidies, government schemes, or low-interest loans available for farmers in ${location}, Bangladesh, specifically for ${crop} farming or general agriculture in ${currentYear}.
      Focus on programs from the Department of Agricultural Extension (DAE), Bangladesh Bank, or Ministry of Agriculture.
      
      RESPONSE FORMAT:
      - Respond in JSON format.
      - 'schemes': array of objects with 'title', 'description', 'eligibility', and 'howToApply'.
      - 'sourceLinks': array of strings (URLs) where the user can find more info.
      - Language: ${lang === 'bn' ? 'Bangla' : 'English'}.
      - CRITICAL: Keep descriptions practical and actionable.`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            schemes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  eligibility: { type: Type.STRING },
                  howToApply: { type: Type.STRING }
                }
              }
            },
            sourceLinks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['schemes']
        },
        tools: [{ googleSearch: {} }],
        toolConfig: {
          includeServerSideToolInvocations: true
        }
      };

      try {
        const response = await callAiWithFallback({
          contents: prompt,
          config
        }, SEARCH_MODEL);
        return JSON.parse(response.text || '{}');
      } catch (searchError) {
        console.warn("Search model failed for schemes, falling back:", searchError);
        const fallbackResponse = await callAiWithFallback({
          contents: `Provide general information about common agricultural subsidies and schemes in Bangladesh for ${crop} farmers. Return JSON with 'schemes' array. Language: ${lang === 'bn' ? 'Bangla' : 'English'}.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: config.responseSchema
          }
        }, BACKUP_MODEL);
        return JSON.parse(fallbackResponse.text || '{}');
      }
    } catch (error) {
      console.error("AI Service Error (Gov Schemes):", error);
      throw error;
    }
  });
};

export const startAgriChat = (context: string, lang: string, locationContext: string = "Bangladesh") => {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemma-4-31b',
    config: {
      systemInstruction: `You are a helpful agricultural expert in Bangladesh. 
      CONTEXT: The user has just received a diagnosis for their crop: "${context}".
      TASK: Answer follow-up questions from the user about this diagnosis. 
      - Provide practical, chemical-free, or climate-smart advice.
      - Use local context for ${locationContext}.
      - Respond in ${lang === 'bn' ? 'Bangla' : 'English'}.
      - CRITICAL: Be extremely concise. Keep answers short, sweet, and to the point. 
      - Use markdown for formatting to make it readable.`,
    },
  });
};
