/**
 * Phase 9: the assistant's name and the shapes shared by the client services
 * and the screens. The server mirrors the request and response in
 * netlify/functions/assistant.ts; see docs/PHASE9_ASSISTANT_SPEC.md.
 *
 * Never hard-code the name anywhere else: use ASSISTANT_NAME.
 */

export const ASSISTANT_NAME = { bn: 'কৃষি সাথী', en: 'Krishi Sathi' } as const;

/**
 * The Home card heading. Bangla attaches the case ending to the name ("কে"), so
 * the phrase is written out here: a rename is one place.
 */
export const ASK_HEADING = { bn: 'কৃষি সাথীকে জিজ্ঞাসা করুন', en: 'Ask Krishi Sathi' } as const;

/** Where a part of an answer came from. Shown as a small label under the answer. */
export type AssistantSource =
  | 'rules'
  | 'farmer_records'
  | 'govt_bulletin'
  | 'weather_forecast'
  | 'ai_estimate'
  | 'app_data';

export const ASSISTANT_SOURCES: readonly AssistantSource[] = [
  'rules',
  'farmer_records',
  'govt_bulletin',
  'weather_forecast',
  'ai_estimate',
  'app_data',
];

export const SOURCE_LABELS: Record<AssistantSource, { bn: string; en: string }> = {
  rules: { bn: 'নিয়ম অনুযায়ী', en: 'From the rules' },
  farmer_records: { bn: 'আপনার হিসাব থেকে', en: 'From your records' },
  govt_bulletin: { bn: 'সরকারি বাজারদর', en: 'Government price bulletin' },
  weather_forecast: { bn: 'আবহাওয়ার পূর্বাভাস', en: 'Weather forecast' },
  ai_estimate: { bn: 'এআই অনুমান', en: 'AI estimate' },
  app_data: { bn: 'অ্যাপের তথ্য', en: 'App data' },
};

export type AssistantLang = 'bn' | 'en';
export type AssistantChannel = 'text' | 'voice' | 'photo';

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The weather reading Home is showing: the same numbers as TodayConditions in
 * netlify/functions/_shared/farm-actions.ts, plus when it was read. The server
 * recomputes the spray/irrigate/fertilise verdicts from it; the client never
 * sends verdicts. Left out when there is no reading.
 */
export interface AssistantToday {
  /** ISO time the reading was fetched. */
  readingAt: string;
  temp: number;
  humidity?: number;
  windSpeed?: number;
  rainChanceToday?: number;
  rainChanceNext12h?: number;
  soilMoisture?: number;
}

export interface AssistantRequest {
  /** The farmer's new message, 1..2000 characters. */
  message: string;
  lang: AssistantLang;
  channel: AssistantChannel;
  /** The last 12 turns or fewer, each up to 4000 characters, oldest first. */
  history?: AssistantHistoryTurn[];
  /** Optional; the server rounds it to 2 decimals, else uses the farm profile location. */
  location?: { lat: number; lon: number };
  /** For example the result of a crop doctor diagnosis. The summary is up to 3000 characters. */
  attachment?: { kind: 'diagnosis'; summary: string };
  /** Today's weather reading, as Home shows it. Omitted when there is none. */
  today?: AssistantToday;
}

export interface AssistantToolCall {
  name: string;
  status: 'done' | 'failed';
}

export interface AssistantResponse {
  /** The answer, plain text. */
  text: string;
  /** At most 10. */
  toolCalls: AssistantToolCall[];
  sources: AssistantSource[];
  model: string;
}
