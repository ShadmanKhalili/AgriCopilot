/**
 * "Should I do this today?" signals for the Home screen, and the week ahead.
 *
 * The decisions come from the shared rule engine
 * (netlify/functions/_shared/farm-actions.ts), the same code the weather
 * function runs, so the same weather always gives the same answer on the phone
 * and on the server. This file only turns the engine's reason codes into
 * Bangla and English sentences.
 *
 * They are general field guidance and do not replace the label on a product or
 * a local officer's advice.
 */

import {
  farmActions,
  fertiliseAction,
  irrigateAction,
  sprayAction,
  todayActionInput,
  todayConditionsFromFeed,
  weekActionsFromFeed,
  type ActionInput,
  type ActionReason,
  type DayActions,
  type FarmAction,
} from '../../netlify/functions/_shared/farm-actions';

export type SignalStatus = 'go' | 'wait' | 'stop';
export type SignalKind = 'spray' | 'irrigate' | 'fertilise';

export interface TodayWeather {
  /** °C */
  temp: number;
  /** % */
  humidity: number;
  /** km/h */
  windSpeed: number;
  /** Highest chance of rain today, %. */
  rainChanceToday: number;
  /** Highest chance of rain in the next 12 hours, %. */
  rainChanceNext12h: number;
  /** Topsoil moisture, m³/m³, when the feed has it. */
  soilMoisture?: number;
}

export interface TodaySignal {
  kind: SignalKind;
  status: SignalStatus;
  /** The instruction, a few words. */
  title: { bn: string; en: string };
  /** Why, in one short line. */
  reason: { bn: string; en: string };
}

export interface DaySignals {
  date: string;                      // 'YYYY-MM-DD'
  signals: TodaySignal[];            // spray, irrigate, fertilise, in that order
  headline: { bn: string; en: string }; // one short plain line for the day, e.g. "Good day to spray" / "Rain likely. Do not spray or fertilise."
  tempMax: number | null;
  tempMin: number | null;
  rainChance: number | null;         // percent
}

type Text = { bn: string; en: string };

// ---------------------------------------------------------------------------
// Wording. Titles come in two forms: "today" for the Home screen, and a plain
// form for a day in the week view.
// ---------------------------------------------------------------------------

const TITLES: Record<SignalKind, Record<SignalStatus, { today: Text; day: Text }>> = {
  spray: {
    stop: {
      today: { bn: 'আজ স্প্রে করবেন না', en: 'Do not spray today' },
      day: { bn: 'স্প্রে করবেন না', en: 'Do not spray' },
    },
    wait: {
      today: { bn: 'ভোরে বা বিকেলে স্প্রে করুন', en: 'Spray early morning or late afternoon' },
      day: { bn: 'ভোরে বা বিকেলে স্প্রে করুন', en: 'Spray early morning or late afternoon' },
    },
    go: {
      today: { bn: 'আজ স্প্রে করা যাবে', en: 'You can spray today' },
      day: { bn: 'স্প্রে করা যাবে', en: 'You can spray' },
    },
  },
  irrigate: {
    stop: {
      today: { bn: 'আজ সেচ লাগবে না', en: 'No need to irrigate today' },
      day: { bn: 'সেচ লাগবে না', en: 'No need to irrigate' },
    },
    wait: {
      today: { bn: 'মাটি দেখে সেচ দিন', en: 'Check the soil, then decide' },
      day: { bn: 'মাটি দেখে সেচ দিন', en: 'Check the soil, then decide' },
    },
    go: {
      today: { bn: 'আজ সেচ দিন', en: 'Irrigate today' },
      day: { bn: 'সেচ দিন', en: 'Irrigate' },
    },
  },
  fertilise: {
    stop: {
      today: { bn: 'আজ সার দেবেন না', en: 'Do not apply fertiliser today' },
      day: { bn: 'সার দেবেন না', en: 'Do not apply fertiliser' },
    },
    wait: {
      today: { bn: 'সার দিতে এক দিন অপেক্ষা করুন', en: 'Wait a day before fertilising' },
      day: { bn: 'সার দিতে এক দিন অপেক্ষা করুন', en: 'Wait a day before fertilising' },
    },
    go: {
      today: { bn: 'আজ সার দেওয়া যাবে', en: 'You can apply fertiliser today' },
      day: { bn: 'সার দেওয়া যাবে', en: 'You can apply fertiliser' },
    },
  },
};

/** Reason sentences, per kind where the wording differs. */
const REASONS: Record<SignalKind, Partial<Record<ActionReason, Text>>> = {
  spray: {
    rain_likely: { bn: 'বৃষ্টি হতে পারে, ওষুধ ধুয়ে যাবে।', en: 'Rain is likely and would wash it off.' },
    wind_strong: { bn: 'বাতাস খুব বেশি, ওষুধ উড়ে যাবে।', en: 'The wind is too strong and would carry it away.' },
    rain_possible: { bn: 'বৃষ্টির কিছু সম্ভাবনা আছে, আকাশ দেখে নিন।', en: 'Some chance of rain; check the sky first.' },
    wind_breezy: { bn: 'দুপুরে বাতাস থাকে, শান্ত সময়ে স্প্রে করুন।', en: 'It is breezy; spray when the air is calm.' },
    too_hot: { bn: 'দুপুরে খুব গরম, ঠান্ডা সময়ে স্প্রে করুন।', en: 'Midday is too hot; spray when it is cooler.' },
    low_risk: { bn: 'বৃষ্টি ও বাতাসের ঝুঁকি কম।', en: 'Low risk of rain and wind.' },
    rain_unlikely: { bn: 'বৃষ্টির সম্ভাবনা কম।', en: 'Rain is unlikely.' },
  },
  irrigate: {
    rain_likely: { bn: 'বৃষ্টি হতে পারে। সেচের খরচ বাঁচান।', en: 'Rain is likely. Save the pumping cost.' },
    soil_wet: { bn: 'মাটিতে যথেষ্ট রস আছে।', en: 'The soil is already moist.' },
    soil_dry: { bn: 'মাটি শুকনো এবং বৃষ্টির সম্ভাবনা কম।', en: 'The soil is dry and rain is unlikely.' },
    check_soil: { bn: 'মাটি শুকনো মনে হলে হালকা সেচ দিন।', en: 'Water lightly if the soil feels dry.' },
  },
  fertilise: {
    rain_likely: { bn: 'বৃষ্টিতে সার ধুয়ে যাবে, টাকা নষ্ট হবে।', en: 'Rain would wash it away and waste your money.' },
    rain_possible: { bn: 'বৃষ্টির কিছু সম্ভাবনা আছে।', en: 'There is some chance of rain.' },
    rain_unlikely: { bn: 'বৃষ্টির সম্ভাবনা কম।', en: 'Rain is unlikely.' },
  },
};

/** Used only if the server sends a reason code this build does not know. */
const FALLBACK_REASON: Record<SignalStatus, Text> = {
  go: { bn: 'আবহাওয়া ভালো।', en: 'The weather is suitable.' },
  wait: { bn: 'আবহাওয়া দেখে কাজ করুন।', en: 'Watch the weather before you start.' },
  stop: { bn: 'আবহাওয়া উপযুক্ত নয়।', en: 'The weather is not suitable.' },
};

const toSignal = (a: FarmAction, when: 'today' | 'day' = 'today'): TodaySignal => ({
  kind: a.kind,
  status: a.status,
  title: TITLES[a.kind][a.status][when],
  reason: REASONS[a.kind][a.reason] ?? FALLBACK_REASON[a.status],
});

const inputOf = (w: TodayWeather): ActionInput =>
  todayActionInput({
    temp: w.temp,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
    rainChanceToday: w.rainChanceToday,
    rainChanceNext12h: w.rainChanceNext12h,
    soilMoisture: w.soilMoisture,
  });

export const spraySignal = (w: TodayWeather): TodaySignal => toSignal(sprayAction(inputOf(w)));

export const irrigateSignal = (w: TodayWeather): TodaySignal => toSignal(irrigateAction(inputOf(w)));

export const fertiliseSignal = (w: TodayWeather): TodaySignal => toSignal(fertiliseAction(inputOf(w)));

export const todaySignals = (w: TodayWeather): TodaySignal[] => farmActions(inputOf(w)).map((a) => toSignal(a));

/** The three signals as one passage for reading aloud. */
export const signalsSpeech = (signals: TodaySignal[], lang: 'bn' | 'en'): string =>
  signals.map((s) => `${s.title[lang]}${lang === 'bn' ? '।' : '.'} ${s.reason[lang]}`).join(' ');

/**
 * The numbers the signals need, from the `/api/weathernext-3` response.
 * Returns null when the response has no current reading.
 */
export const todayWeatherFromFeed = (feed: any): TodayWeather | null => todayConditionsFromFeed(feed);

// ---------------------------------------------------------------------------
// The week ahead
// ---------------------------------------------------------------------------

/**
 * One short plain line for the day, decided by rule from the day's actions.
 * The order is the order of importance: rain, then strong wind, then a chance
 * of rain, then a breeze, then heat.
 */
export const dayHeadline = (actions: FarmAction[]): Text => {
  const spray = actions.find((a) => a.kind === 'spray');
  const irrigate = actions.find((a) => a.kind === 'irrigate');
  const fertilise = actions.find((a) => a.kind === 'fertilise');

  if (spray?.reason === 'rain_likely' || fertilise?.status === 'stop') {
    return { bn: 'বৃষ্টি হতে পারে। স্প্রে বা সার দেবেন না।', en: 'Rain likely. Do not spray or fertilise.' };
  }
  if (spray?.reason === 'wind_strong') {
    return { bn: 'জোর বাতাস। স্প্রে করবেন না।', en: 'Strong wind. Do not spray.' };
  }
  if (spray?.reason === 'rain_possible' || fertilise?.status === 'wait') {
    return {
      bn: 'বৃষ্টি হতে পারে। স্প্রে বা সারের আগে আকাশ দেখুন।',
      en: 'Rain possible. Check the sky before spraying or fertilising.',
    };
  }
  if (spray?.reason === 'wind_breezy') {
    return { bn: 'বাতাস আছে। শান্ত সময়ে স্প্রে করুন।', en: 'Breezy. Spray when the air is calm.' };
  }
  if (spray?.reason === 'too_hot') {
    return { bn: 'গরম দিন। ভোরে বা বিকেলে স্প্রে করুন।', en: 'Hot day. Spray early morning or evening.' };
  }
  if (spray?.status === 'go' && fertilise?.status === 'go') {
    return irrigate?.status === 'go'
      ? { bn: 'স্প্রে ও সারের ভালো দিন। সেচও দিন।', en: 'Good day to spray and fertilise. Irrigate too.' }
      : { bn: 'স্প্রে ও সারের ভালো দিন।', en: 'Good day to spray and fertilise.' };
  }
  if (spray?.status === 'stop') {
    return { bn: 'স্প্রে করবেন না।', en: 'Do not spray.' };
  }
  return { bn: 'আবহাওয়া দেখে কাজ করুন।', en: 'Watch the weather before you start.' };
};

const KINDS: SignalKind[] = ['spray', 'irrigate', 'fertilise'];
const STATUSES: SignalStatus[] = ['go', 'wait', 'stop'];

const isFarmAction = (a: any, kind: SignalKind): a is FarmAction =>
  !!a && a.kind === kind && STATUSES.includes(a.status) && typeof a.reason === 'string';

const nullableNum = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v));

/** The server's precomputed week, when it is present and well formed. */
const serverWeek = (feed: any): DayActions[] | null => {
  const week = feed?.farm_actions?.week;
  if (!Array.isArray(week)) return null;
  const ok = week.every(
    (d: any) =>
      d &&
      typeof d.date === 'string' &&
      Array.isArray(d.actions) &&
      d.actions.length === 3 &&
      KINDS.every((k, i) => isFarmAction(d.actions[i], k)) &&
      nullableNum(d.tempMax) &&
      nullableNum(d.tempMin) &&
      nullableNum(d.rainChance),
  );
  return ok ? week : null;
};

/** Up to 7 days starting today. Uses the feed's `farm_actions.week` when present, otherwise computes it with the same shared rules. Returns [] when the feed has no daily data. */
export function weekSignalsFromFeed(feed: unknown): DaySignals[] {
  const week = serverWeek(feed) ?? weekActionsFromFeed(feed);
  return week.slice(0, 7).map((d, i) => ({
    date: d.date,
    signals: d.actions.map((a) => toSignal(a, i === 0 ? 'today' : 'day')),
    headline: dayHeadline(d.actions),
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    rainChance: d.rainChance,
  }));
}
