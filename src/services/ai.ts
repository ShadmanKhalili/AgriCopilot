import { GoogleGenAI, Type, Modality } from '@google/genai';

const getAi = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

const getModelName = (isAdvanced?: boolean) => isAdvanced ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';

export const diagnoseCrop = async (imageBase64: string, mimeType: string, crop: string, upazila: string, analysisType: string, isAdvanced?: boolean) => {
  const ai = getAi();
  const prompt = `You are a Bangladesh DAE agronomist. Perform a ${analysisType} analysis on this image of a ${crop} from ${upazila}, Cox's Bazar. Recommend a chemical-free or climate-smart solution available locally. Respond in Bangla in under 100 words.`;
  
  const response = await ai.models.generateContent({
    model: getModelName(isAdvanced),
    contents: [
      { inlineData: { data: imageBase64, mimeType } },
      prompt
    ]
  });
  
  return response.text;
};

export const generateSpeech = async (text: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};

export const gradeProduce = async (imageBase64: string, mimeType: string, produce: string, isAdvanced?: boolean) => {
  const ai = getAi();
  const prompt = `You are an expert agricultural quality inspector. Grade this batch of ${produce}. Assign a grade (Grade A, Grade B, or Reject) based on visual quality, uniformity, and defects. Provide a short justification, an estimated price per kg in BDT, estimated shelf life, and the best market route.`;
  
  const response = await ai.models.generateContent({
    model: getModelName(isAdvanced),
    contents: [
      { inlineData: { data: imageBase64, mimeType } },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grade: { type: Type.STRING, description: 'Grade A, Grade B, or Reject' },
          justification: { type: Type.STRING, description: 'Short justification for the grade' },
          estimatedPriceBdt: { type: Type.NUMBER, description: 'Estimated price per kg in BDT' },
          shelfLife: { type: Type.STRING, description: 'Estimated shelf life (e.g., 3-5 days)' },
          bestMarket: { type: Type.STRING, description: 'Recommended market type (e.g., Local Bazaar, Supermarket, Export)' }
        },
        required: ['grade', 'justification', 'estimatedPriceBdt', 'shelfLife', 'bestMarket']
      }
    }
  });
  
  return JSON.parse(response.text || '{}');
};

export const getMarketInsights = async (produce: string, location: string, lang: string, isAdvanced?: boolean) => {
  const ai = getAi();
  const prompt = `Search for the current market price and demand trends for ${produce} in ${location}, Bangladesh. Based on the data, provide a short market insight including current estimated price, demand level (High/Medium/Low), and a recommendation on whether to sell now or hold. Language: ${lang === 'bn' ? 'Bangla' : 'English'}. Do not use markdown formatting.`;
  
  const response = await ai.models.generateContent({
    model: getModelName(isAdvanced),
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });
  
  return response.text;
};
