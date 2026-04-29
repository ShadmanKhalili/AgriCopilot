import { Type, GoogleGenAI, Modality } from '@google/genai';
import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';

// Helper to call AI via Netlify proxy
const callAiProxy = async (params: any) => {
  try {
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      let errorMessage = `AI Proxy Failed (Status: ${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Not JSON
      }
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (err: any) {
    console.error("Critical AI Proxy Error:", err);
    throw err;
  }
};

// Singleton AI instance using platform-injected key
let aiInstance: GoogleGenAI | null = null;
export const getAi = () => {
  // If we are in the browser and don't have a key, we'll use the proxy instead
  // of initializing the SDK here.
  const apiKey = (process.env.GEMINI_API_KEY as string) || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
  
  if (apiKey && !aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

// Generic wrapper for AI calls that handles Proxy vs Direct SDK
const generateContent = async (params: any) => {
  const ai = getAi();
  if (!ai) {
    // If no API key is set in browser, use Netlify proxy
    return await callAiProxy(params);
  }
  
  const { model, contents, config, tools, toolConfig, responseModalities, speechConfig, generationConfig } = params;

  try {
    const response = await ai.models.generateContent({
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
      text: response.text,
      candidates: response.candidates,
      promptFeedback: response.promptFeedback
    };
  } catch (error: any) {
    console.error("Direct AI Call Failed:", error);
    throw error;
  }
};

export { Type };

const getModelName = (isAdvanced?: boolean) => isAdvanced ? 'gemini-3.1-flash-lite-preview' : 'gemini-3.1-flash-lite-preview';
const BACKUP_MODEL = 'gemini-3.1-flash-lite-preview';
const SEARCH_MODEL = 'gemini-3.1-flash-lite-preview';
const TTS_PRIMARY_MODEL = 'gemini-3.1-flash-tts-preview';
const TTS_BACKUP_MODEL = 'gemini-3.1-flash-tts-preview'; 
export const LIVE_API_MODEL = 'gemini-3.1-flash-live-preview';
const CHAT_MODEL = 'gemini-3.1-flash-lite-preview';

const callAiWithRetry = async (fn: () => Promise<any>, retries = 6, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorStr = JSON.stringify(error).toLowerCase();
      const isQuotaError = error.message?.includes('429') || 
                          error.message?.includes('RESOURCE_EXHAUSTED') || 
                          errorStr.includes('quota') || 
                          errorStr.includes('429');
      
      const isNotFoundError = error.message?.includes('404') || 
                              errorStr.includes('not_found');
      
      if (i === retries - 1 && !isNotFoundError) throw error;
      if (isNotFoundError && i === retries - 1) throw error;
      
      // Exponential backoff with jitter
      const backoffFactor = isQuotaError ? 3 : 2;
      const currentDelay = (delay * Math.pow(backoffFactor, i)) + (Math.random() * 1000);
      
      console.warn(`AI call failed (${isQuotaError ? 'Quota Exceeded' : (isNotFoundError ? 'Not Found' : 'Error')}), retrying in ${Math.round(currentDelay)}ms (${i + 1}/${retries})...`);
      
      await new Promise(res => setTimeout(res, currentDelay));
    }
  }
};

const callAiWithFallback = async (params: any, primaryModel: string, customBackupModel?: string) => {
  const fallbacks = [
    primaryModel,
    customBackupModel || BACKUP_MODEL,
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview'
  ];
  
  // Try models in sequence until one works
  let lastError = null;
  for (const model of new Set(fallbacks)) {
    if (!model) continue;
    try {
      return await generateContent({ ...params, model });
    } catch (error: any) {
      console.warn(`Model ${model} failed:`, error.message);
      lastError = error;
      // If it's not a quota error or internal error, perhaps still retry next model
    }
  }
  throw lastError;
};

export const diagnoseCrop = async (
  images: { base64: string; mimeType: string }[], 
  crop: string, 
  cropStage: string, 
  analysisType: string, 
  lang: string, 
  isAdvanced?: boolean,
  coords?: { latitude: number; longitude: number },
  description?: string
) => {
  return await callAiWithRetry(async () => {
    try {
      const locationContext = coords 
        ? `Precise GPS Location: ${coords.latitude}, ${coords.longitude}.` 
        : `Location: Unknown (Please advise based on general best practices).`;

      const userNoteContext = description ? `\nThe user has also provided this additional note/description regarding the plant: "${description}"\n` : '';

      const prompt = `You are a world-class agricultural expert specializing in crops from Bangladesh.
      Analyze the provided image(s) of a ${crop || 'plant (please identify the crop)'} plant at the ${cropStage || 'unknown'} stage.
      ${locationContext}${userNoteContext}
      
      The user is specifically interested in ${analysisType || 'its general health and any visible issues'}.
      
      Provide a comprehensive diagnosis in ${lang === 'bn' ? 'Bangla' : 'English'}.
      Your response must be approximately 100 words, detailed, and not generalized.
      
      CRITICAL: You MUST translate ALL field values (visibleSymptoms, possibleDiseases, differentialDiagnosis, diagnosis, symptomsBreakdown, verificationAdvice) into ${lang === 'bn' ? 'Bangla' : 'English'} accurately. Even technical crop disease names should be translated or transliterated if they are commonly known in the local language. ALL text in the JSON values must be in ${lang === 'bn' ? 'Bangla' : 'English'}.
      
      If multiple images are provided, synthesize the information from all of them to provide a more accurate diagnosis.
      
      CRITICAL ANALYSIS GUIDELINES & CHAIN OF THOUGHT:
      To ensure high accuracy, you MUST follow a deductive reasoning pattern. Do not jump to conclusions. Your JSON must include:
      - 'visibleSymptoms': A detailed list of all symptoms visible in the image.
      - 'possibleDiseases': A list of at least 3 possible conditions that match the symptoms and the crop.
      - 'differentialDiagnosis': An explanation of why it is the final disease and NOT the others.
      - DO NOT provide specific chemical/nutrient percentages (e.g., N/P/K %) as these cannot be reliably diagnosed from images alone. Instead, suggest general nutritional health based on vigor and color.
      - SAFETY FIRST: Be exceptionally cautious when recommending any synthetic pesticides or chemicals. Prioritize food safety and explicitly advise on farmer safety (e.g., wearing mandatory protective gear, safe handling, and withholding periods before harvest).
      
      Return the response in the following JSON format:
      {
        "status": "Valid" | "Invalid",
        "visibleSymptoms": "Detailed description of visible symptoms",
        "possibleDiseases": ["Condition 1", "Condition 2", "Condition 3"],
        "differentialDiagnosis": "Reasoning for choosing the final diagnosis",
        "diagnosis": "Detailed markdown final diagnosis and treatment plan (approx 100 words)",
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
            visibleSymptoms: { type: Type.STRING },
            possibleDiseases: { type: Type.ARRAY, items: { type: Type.STRING } },
            differentialDiagnosis: { type: Type.STRING },
            diagnosis: { type: Type.STRING, description: 'Detailed diagnosis text' },
            qualitativeSeverity: { type: Type.STRING, description: 'Low, Medium, or High' },
            symptomsBreakdown: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'List of visible symptoms'
            },
            verificationAdvice: { type: Type.STRING, description: 'Advice for further verification' }
          },
          required: ['status', 'visibleSymptoms', 'possibleDiseases', 'differentialDiagnosis', 'diagnosis', 'qualitativeSeverity', 'symptomsBreakdown', 'verificationAdvice']
        }
      };
      
      const contents: any[] = images.map(img => ({ parts: [{ inlineData: { data: img.base64, mimeType: img.mimeType } }] }));
      contents.push({ parts: [{ text: prompt }] });

      const response = await generateContent({
        contents,
        config,
        model: getModelName(isAdvanced)
      });
      
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

export const deepDiagnoseCrop = async (
  images: { base64: string; mimeType: string }[], 
  crop: string, 
  cropStage: string, 
  analysisType: string, 
  lang: string, 
  basicDiagnosis: any,
  coords?: { latitude: number; longitude: number },
  description?: string
) => {
  return await callAiWithRetry(async () => {
    try {
      const locationContext = coords 
        ? `Location: ${coords.latitude}, ${coords.longitude} (Bangladesh).` 
        : `Location: Bangladesh.`;

      const userNoteContext = description ? `\nUSER'S ADDITIONAL NOTES/DESCRIPTION: "${description}"\n` : '';

      const prompt = `You are a SENIOR AGRICULTURAL PATHOLOGIST and INDEPENDENT DIAGNOSTIC AUDITOR.
      
      A user has uploaded images of a ${crop || 'plant'} plant at the ${cropStage || 'unknown'} stage in ${locationContext}.
      ${userNoteContext}
      WORKING HYPOTHESIS (For audit only):
      - Preliminary Claim: ${basicDiagnosis.diagnosis}
      - Symptoms Noted: ${basicDiagnosis.symptomsBreakdown?.join(', ')}
      
      YOUR MISSION:
      Reach the GROUND TRUTH using forensic visual evidence. Do not blindly confirm the preliminary claim, but do not contradict it without definitive proof.
      
      STEP 0: INDEPENDENT VISUAL AUDIT
      Ignore the preliminary claim for a moment. Examine the images and list every visual abnormality (edges, spots, curling, texture, spores, pests).
      
      STEP 1: DIFFERENTIAL AUDIT
      - Compare the preliminary claim against 2-3 most likely alternatives (e.g., Disease vs Nutrient vs Pest).
      - If the preliminary claim ("${basicDiagnosis.diagnosis}") is correct, identify the "Technical Signature" (the specific visual mark) that confirms it beyond doubt.
      - If it is incorrect, provide the logical proof for the correction.
      
      STEP 2: GROUNDING & CONTEXT
      - Use GOOGLE SEARCH to cross-reference these symptoms with current climate and disease outbreaks in Bangladesh for ${crop}.
      - Check if the humidity and temperature in ${locationContext} currently support the suspected pathogen.
      
      STEP 3: FINAL EXPERT VERDICT
      - Provide a final diagnosis with high physiological certainty.
      - Give EXACT dosages for local brands (ACI, Syngenta, etc.).
      - Provide a specific PHI (Pre-Harvest Interval).

      CRITICAL: Translate all fields to ${lang === 'bn' ? 'Bangla' : 'English'}.
      
      Respond in ${lang === 'bn' ? 'Bangla' : 'English'} in the following JSON format:
      {
        "visibleSymptoms": "Hyper-detailed forensic breakdown of visual evidence.",
        "severityScore": 1-10,
        "hypothesesEvaluation": "Objective audit of the initial hypothesis vs your findings. Confirm if correct, or explain the correction (markdown).",
        "possibleAlternatives": ["Alternative 1", "Alternative 2"],
        "differentialReasoning": "The definitive evidence that proves your final conclusion and rules out alternatives (markdown).",
        "detailedDiagnosis": "Final expert conclusion with physiological context (markdown).",
        "recoveryTimeline": "Actionable timeline: Day 1, Week 1, Month 1 (markdown).",
        "advancedTreatment": "CHEMICAL and ORGANIC protocols with EXACT dosages and safety rules (markdown).",
        "environmentalContext": "Search-grounded local context and outbreak data (markdown).",
        "biologicalCause": "Technical Pathogen details (provide this last).",
        "sources": ["URLs used"]
      }`;
      
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visibleSymptoms: { type: Type.STRING },
            severityScore: { type: Type.NUMBER },
            hypothesesEvaluation: { type: Type.STRING },
            possibleAlternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
            differentialReasoning: { type: Type.STRING },
            detailedDiagnosis: { type: Type.STRING },
            recoveryTimeline: { type: Type.STRING },
            advancedTreatment: { type: Type.STRING },
            environmentalContext: { type: Type.STRING },
            biologicalCause: { type: Type.STRING },
            sources: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: [
            'visibleSymptoms', 'severityScore', 'hypothesesEvaluation', 'possibleAlternatives', 
            'differentialReasoning', 'detailedDiagnosis', 'recoveryTimeline', 
            'advancedTreatment', 'environmentalContext', 'biologicalCause', 'sources'
          ]
        },
        tools: [{ googleSearch: {} }]
      };
      
      const contents: any[] = images.map(img => ({ parts: [{ inlineData: { data: img.base64, mimeType: img.mimeType } }] }));
      contents.push({ parts: [{ text: prompt }] });

      // Always use SEARCH_MODEL (flash-preview) for search grounding
      const response = await generateContent({
        contents,
        config,
        model: SEARCH_MODEL
      });
      
      if (!response.text) {
        throw new Error("AI returned an empty response.");
      }
      
      return JSON.parse(response.text);
    } catch (error) {
      console.error("AI Service Error (Deep Diagnose Crop):", error);
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
        contents: [{ parts: [{ text: prompt }] }]
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
      const now = new Date();
      const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
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
      Current Date: ${currentDate}
      Current Time: ${currentTime}
      Current Weather at GPS (${coords.latitude}, ${coords.longitude}):
      Temp: ${weatherData.temp.toFixed(1)}°C, Condition: ${weatherData.condition}, Humidity: ${weatherData.humidity}%, Wind: ${weatherData.windSpeed}km/h, Rain: ${weatherData.rainfall}mm.
      Safe Spraying Window: ${weatherData.safeSprayingWindow}
      ${climateContext}
      ${historicalTodayContext}
      ${soilContext}
      
      Provide a short, actionable farming advisory in ${lang === 'bn' ? 'Bangla' : 'English'} (approx 80-100 words).
      Focus on:
      - Time of day: Adjust your advice based on the current time (${currentTime}).
      - Irrigation needs (use soil moisture and evapotranspiration data if available)
      - Fertilizer/Soil health advice (use soil pH, Nitrogen, Carbon data if available)
      - Pest/Disease risk based on humidity and temperature
      - Sowing/Harvesting timing
      - Use of the Safe Spraying Window for pesticide application.
      
      Use markdown for formatting. Be direct and practical.`;

      const response = await generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        model: SEARCH_MODEL
      });
      
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
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      }, TTS_PRIMARY_MODEL, TTS_BACKUP_MODEL);
      
      console.log("TTS Response received", !!response.candidates?.[0]);
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        console.warn("No audio data in response content parts", JSON.stringify(response.candidates?.[0]?.content?.parts));
        return null;
      }

      // Gemini TTS returns raw 16-bit PCM at 24000Hz. 
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

export const summarizeConversation = async (messages: { role: string; text: string }[], lang: string) => {
  return await callAiWithRetry(async () => {
    try {
      const chatStr = messages.map(m => `${m.role === 'user' ? 'Farmer' : 'Expert'}: ${m.text}`).join('\n');
      const prompt = `Summarize the following agricultural consultation conversation into a few key bullet points and a short summary paragraph. 
      Maintain a helpful and professional tone.
      Respond in ${lang === 'bn' ? 'Bangla' : 'English'}.
      
      Conversation History:
      ${chatStr}`;

      const response = await callAiWithFallback({
        contents: [{ parts: [{ text: prompt }] }]
      }, BACKUP_MODEL);
      
      return response.text || '';
    } catch (error) {
      console.error("AI Service Error (Summarize Conversation):", error);
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
      
      const response = await generateContent({
        contents: [
          { parts: [{ inlineData: { data: imageBase64, mimeType } }] },
          { parts: [{ text: prompt }] }
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
        },
        model: getModelName(isAdvanced)
      });
      
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
        tools: [{ googleSearch: {} }]
      };

      try {
        const response = await generateContent({
          contents: [{ parts: [{ text: prompt }] }],
          config,
          toolConfig: { includeServerSideToolInvocations: true },
          model: SEARCH_MODEL
        });
        return JSON.parse(response.text || '{}');
      } catch (searchError) {
        console.warn("Google Search model failed, falling back to standard generation:", searchError);
        const fallbackResponse = await generateContent({
          contents: [{ parts: [{ text: `Provide estimated market insight for ${produce} for the period around ${today}. Return JSON with 'insights' and 'priceDrivers'. Language: ${lang === 'bn' ? 'Bangla' : 'English'}.` }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: config.responseSchema
          },
          model: BACKUP_MODEL
        });
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
        tools: [{ googleSearch: {} }]
      };

      try {
        const response = await generateContent({
          contents: [{ parts: [{ text: prompt }] }],
          config,
          toolConfig: { includeServerSideToolInvocations: true },
          model: SEARCH_MODEL
        });
        return JSON.parse(response.text || '{}');
      } catch (searchError) {
        console.warn("Search model failed for schemes, falling back:", searchError);
        const fallbackResponse = await generateContent({
          contents: [{ parts: [{ text: `Provide general information about common agricultural subsidies in Bangladesh for ${crop} farmers. Return JSON with 'schemes' array. Language: ${lang === 'bn' ? 'Bangla' : 'English'}.` }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: config.responseSchema
          },
          model: BACKUP_MODEL
        });
        return JSON.parse(fallbackResponse.text || '{}');
      }
    } catch (error) {
      console.error("AI Service Error (Gov Schemes):", error);
      throw error;
    }
  });
};

export const getPlantingRecommendations = async (
  coords: { latitude: number; longitude: number },
  landType: string,
  landSize: string,
  irrigation: string,
  previousCrop: string,
  budget: string,
  targetTime: string,
  weatherData: any,
  satelliteData: any,
  lang: string,
  isAdvanced?: boolean
) => {
  return await callAiWithRetry(async () => {
    try {
      const today = new Date().toLocaleDateString('en-GB');
      
      let weatherContext = "";
      if (weatherData && weatherData.current) {
        weatherContext = `CURRENT WEATHER: Temp: ${weatherData.current.temperature_2m}°C, Humidity: ${weatherData.current.relative_humidity_2m}%, Rain: ${weatherData.current.precipitation}mm.`;
      }

      let satelliteContext = "";
      if (satelliteData) {
        satelliteContext = `SATELLITE DATA (30-day avg): NDVI (Vegetation Health): ${satelliteData.ndvi?.toFixed(2)}, NDMI (Moisture): ${satelliteData.ndmi?.toFixed(2)}.`;
      }

      const prompt = `You are an expert agricultural recommendation engine for Bangladesh.
      Apply a 5-layer scoring system to recommend what crops a farmer should plant next.
      
      FARMER PROFILE:
      - Location: GPS (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})
      - Land Type: ${landType}
      - Land Size: ${landSize} decimals
      - Previous Crop: ${previousCrop}
      - Investment Budget: ${budget}
      - Target Planting Time: ${targetTime}

      ENVIRONMENTAL DATA:
      ${weatherContext}
      ${satelliteContext}

      OUTPUT REQUIREMENTS:
      - Recommend the Top 3 crops.
      - Suggest 1-2 crops to AVOID.
      - Suggest 1 diversification crop.
      - Language: ${lang === 'bn' ? 'Bangla' : 'English'}.

      RESPONSE FORMAT (JSON):
      {
        "recommended": [
          {
            "crop": "Crop Name",
            "expectedMargin": "Estimated net margin",
            "reasons": ["Reason 1"],
            "detailedAnalysis": "...",
            "riskLevel": "Low" | "Medium" | "High",
            "riskReason": "..."
          }
        ],
        "avoid": [
          { "crop": "Crop Name", "evidence": "..." }
        ],
        "diversification": {
          "crop": "Crop Name",
          "reasons": ["..."],
          "detailedAnalysis": "...",
          "riskLevel": "...",
          "riskReason": "..."
        }
      }`;

      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommended: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  crop: { type: Type.STRING },
                  expectedMargin: { type: Type.STRING },
                  reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  detailedAnalysis: { type: Type.STRING },
                  riskLevel: { type: Type.STRING },
                  riskReason: { type: Type.STRING }
                },
                required: ['crop', 'expectedMargin', 'reasons', 'detailedAnalysis', 'riskLevel', 'riskReason']
              }
            },
            avoid: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  crop: { type: Type.STRING },
                  evidence: { type: Type.STRING }
                },
                required: ['crop', 'evidence']
              }
            },
            diversification: {
              type: Type.OBJECT,
              properties: {
                crop: { type: Type.STRING },
                reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                detailedAnalysis: { type: Type.STRING },
                riskLevel: { type: Type.STRING },
                riskReason: { type: Type.STRING }
              },
              required: ['crop', 'reasons', 'detailedAnalysis', 'riskLevel', 'riskReason']
            }
          },
          required: ['recommended', 'avoid', 'diversification']
        }
      };

      const response = await generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        config,
        model: getModelName(isAdvanced)
      });
      
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("AI Service Error (Planting Recommendations):", error);
      throw error;
    }
  });
};

export const startAgriChat = (context: string, lang: string, locationContext: string = "Bangladesh") => {
  const history: { role: string; text: string }[] = [];
  return {
    sendMessage: async (req: { message: string }) => {
      const prompt = history.length === 0 
        ? `You are a helpful agricultural expert in Bangladesh. 
           CONTEXT: The user has just received a diagnosis for their crop: "${context}".
           TASK: Handle the user's first follow-up question: "${req.message}".
           Respond in ${lang === 'bn' ? 'Bangla' : 'English'}. Concise markdown.`
        : req.message;

      const contents = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const response = await generateContent({
        contents,
        model: CHAT_MODEL
      });
      
      const responseText = response.text || '';
      history.push({ role: 'user', text: req.message });
      history.push({ role: 'model', text: responseText });
      
      return { text: responseText };
    }
  };
};

export const startSchemeChat = (scheme: any, lang: string) => {
  const history: { role: string; text: string }[] = [];
  const schemeContext = `
    Title: ${scheme.title[lang]}
    Description: ${scheme.description[lang]}
    Eligibility: ${scheme.eligibility[lang]}
    How to Apply: ${scheme.howToApply[lang]}
    Benefits: ${scheme.benefits?.[lang] || 'N/A'}
    Provider: ${scheme.provider || 'N/A'}
  `;

  return {
    sendMessage: async (req: { message: string }) => {
      const prompt = history.length === 0 
        ? `You are an expert agricultural advisor specializing in government schemes in Bangladesh. 
           The user is asking about the following scheme:
           ${schemeContext}
           
           Help them understand how they can avail these benefits, what documents they might need, or clarify any parts of the eligibility.
           USER'S FIRST QUESTION: "${req.message}"
           
           Respond in ${lang === 'bn' ? 'Bangla' : 'English'}. Be encouraging, practical, and clear. Use markdown.`
        : req.message;

      const contents = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const response = await generateContent({
        contents,
        model: CHAT_MODEL
      });
      
      const responseText = response.text || '';
      history.push({ role: 'user', text: req.message });
      history.push({ role: 'model', text: responseText });
      
      return { text: responseText };
    }
  };
};

export const syncCuratedSchemes = async () => {
  return await callAiWithRetry(async () => {
    try {
      const today = new Date().toISOString();
      const prompt = `Use Google Search to find LATEST agricultural subsidies, government schemes, or financial aid programs in Bangladesh for ${new Date().getFullYear()}. 
      Return a list of unique schemes. Ensure each scheme is distinct with no duplicates. 
      For each scheme, ensure the 'benefits' field is a concise, point-wise summary of unique benefits.
      Each scheme must follow the provided schema.
      Language: Ensure both 'en' and 'bn' fields are populated for all text fields.`;
      
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
                  id: { type: Type.STRING },
                  title: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      bn: { type: Type.STRING }
                    },
                    required: ['en', 'bn']
                  },
                  description: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      bn: { type: Type.STRING }
                    },
                    required: ['en', 'bn']
                  },
                  eligibility: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      bn: { type: Type.STRING }
                    },
                    required: ['en', 'bn']
                  },
                  howToApply: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      bn: { type: Type.STRING }
                    },
                    required: ['en', 'bn']
                  },
                  benefits: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      bn: { type: Type.STRING }
                    }
                  },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  provider: { type: Type.STRING },
                  sourceLinks: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['title', 'description', 'eligibility', 'howToApply']
              }
            }
          },
          required: ['schemes']
        },
        tools: [{ googleSearch: {} }]
      };

      const response = await generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        config,
        toolConfig: { includeServerSideToolInvocations: true },
        model: SEARCH_MODEL
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.schemes && Array.isArray(parsed.schemes)) {
        const batch = writeBatch(db);
        const colRef = collection(db, 'gov_schemes');
        const slugify = (text: string) => text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');

        // Fetch existing schemes to identify and remove potential duplicates with old random IDs
        const existingSnapshot = await getDocs(colRef);
        const existingDocs = existingSnapshot.docs.map(d => ({ id: d.id, titleEn: d.data().title?.en }));

        parsed.schemes.forEach((scheme: any) => {
          // Generate a deterministic ID based on the English title to prevent future duplicates
          const titleEn = scheme.title?.en || '';
          const deterministicId = titleEn ? slugify(titleEn) : Math.random().toString(36).substr(2, 9);
          
          // Cleanup existing duplicates that match by title but have different IDs (old random IDs)
          existingDocs.forEach(oldDoc => {
            if (oldDoc.titleEn && titleEn && oldDoc.titleEn.trim().toLowerCase() === titleEn.trim().toLowerCase() && oldDoc.id !== deterministicId) {
              batch.delete(doc(colRef, oldDoc.id));
            }
          });

          const docRef = doc(colRef, deterministicId);
          batch.set(docRef, { 
            ...scheme, 
            id: deterministicId, // Ensure the field ID matches doc ID
            lastUpdated: today 
          });
        });
        await batch.commit();
        return parsed.schemes.length;
      }
      return 0;
    } catch (error) {
      console.error("AI Service Error (Sync Schemes):", error);
      throw error;
    }
  });
};

export const getMarketInsightsByLocation = async (produce: string, location: string, lang: string) => {
  return await getMarketInsights(produce, lang, false);
};
