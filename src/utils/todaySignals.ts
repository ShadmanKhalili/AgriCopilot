/**
 * "Should I do this today?" signals for the Home screen.
 *
 * These are fixed rules on the weather numbers, not AI text, so the same
 * weather always gives the same answer. They are general field guidance and
 * do not replace the label on a product or a local officer's advice.
 */

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

// Thresholds. Rain within hours washes spray and fertiliser away; wind above
// about 15 km/h starts to carry spray off the crop.
const RAIN_LIKELY = 50;
const RAIN_POSSIBLE = 25;
const WIND_TOO_STRONG = 20;
const WIND_BREEZY = 14;
const TOO_HOT_TO_SPRAY = 33;
const SOIL_WET = 0.35;
const SOIL_DRY = 0.22;

const rainSoon = (w: TodayWeather): number => Math.max(w.rainChanceToday, w.rainChanceNext12h);

export const spraySignal = (w: TodayWeather): TodaySignal => {
  const rain = rainSoon(w);
  if (rain >= RAIN_LIKELY) {
    return {
      kind: 'spray',
      status: 'stop',
      title: { bn: 'আজ স্প্রে করবেন না', en: 'Do not spray today' },
      reason: { bn: 'বৃষ্টি হতে পারে, ওষুধ ধুয়ে যাবে।', en: 'Rain is likely and would wash it off.' },
    };
  }
  if (w.windSpeed > WIND_TOO_STRONG) {
    return {
      kind: 'spray',
      status: 'stop',
      title: { bn: 'আজ স্প্রে করবেন না', en: 'Do not spray today' },
      reason: { bn: 'বাতাস খুব বেশি, ওষুধ উড়ে যাবে।', en: 'The wind is too strong and would carry it away.' },
    };
  }
  if (rain >= RAIN_POSSIBLE || w.windSpeed > WIND_BREEZY || w.temp > TOO_HOT_TO_SPRAY) {
    return {
      kind: 'spray',
      status: 'wait',
      title: { bn: 'ভোরে বা বিকেলে স্প্রে করুন', en: 'Spray early morning or late afternoon' },
      reason:
        rain >= RAIN_POSSIBLE
          ? { bn: 'বৃষ্টির কিছু সম্ভাবনা আছে, আকাশ দেখে নিন।', en: 'Some chance of rain; check the sky first.' }
          : w.windSpeed > WIND_BREEZY
            ? { bn: 'দুপুরে বাতাস থাকে, শান্ত সময়ে স্প্রে করুন।', en: 'It is breezy; spray when the air is calm.' }
            : { bn: 'দুপুরে খুব গরম, ঠান্ডা সময়ে স্প্রে করুন।', en: 'Midday is too hot; spray when it is cooler.' },
    };
  }
  return {
    kind: 'spray',
    status: 'go',
    title: { bn: 'আজ স্প্রে করা যাবে', en: 'You can spray today' },
    reason: { bn: 'বৃষ্টি ও বাতাসের ঝুঁকি কম।', en: 'Low risk of rain and wind.' },
  };
};

export const irrigateSignal = (w: TodayWeather): TodaySignal => {
  if (rainSoon(w) >= RAIN_LIKELY) {
    return {
      kind: 'irrigate',
      status: 'stop',
      title: { bn: 'আজ সেচ লাগবে না', en: 'No need to irrigate today' },
      reason: { bn: 'বৃষ্টি হতে পারে। সেচের খরচ বাঁচান।', en: 'Rain is likely. Save the pumping cost.' },
    };
  }
  if (w.soilMoisture !== undefined && w.soilMoisture >= SOIL_WET) {
    return {
      kind: 'irrigate',
      status: 'stop',
      title: { bn: 'আজ সেচ লাগবে না', en: 'No need to irrigate today' },
      reason: { bn: 'মাটিতে যথেষ্ট রস আছে।', en: 'The soil is already moist.' },
    };
  }
  if (w.soilMoisture !== undefined && w.soilMoisture < SOIL_DRY) {
    return {
      kind: 'irrigate',
      status: 'go',
      title: { bn: 'আজ সেচ দিন', en: 'Irrigate today' },
      reason: { bn: 'মাটি শুকনো এবং বৃষ্টির সম্ভাবনা কম।', en: 'The soil is dry and rain is unlikely.' },
    };
  }
  return {
    kind: 'irrigate',
    status: 'wait',
    title: { bn: 'মাটি দেখে সেচ দিন', en: 'Check the soil, then decide' },
    reason: { bn: 'মাটি শুকনো মনে হলে হালকা সেচ দিন।', en: 'Water lightly if the soil feels dry.' },
  };
};

export const fertiliseSignal = (w: TodayWeather): TodaySignal => {
  const rain = rainSoon(w);
  if (rain >= RAIN_LIKELY) {
    return {
      kind: 'fertilise',
      status: 'stop',
      title: { bn: 'আজ সার দেবেন না', en: 'Do not apply fertiliser today' },
      reason: { bn: 'বৃষ্টিতে সার ধুয়ে যাবে, টাকা নষ্ট হবে।', en: 'Rain would wash it away and waste your money.' },
    };
  }
  if (rain >= RAIN_POSSIBLE) {
    return {
      kind: 'fertilise',
      status: 'wait',
      title: { bn: 'সার দিতে এক দিন অপেক্ষা করুন', en: 'Wait a day before fertilising' },
      reason: { bn: 'বৃষ্টির কিছু সম্ভাবনা আছে।', en: 'There is some chance of rain.' },
    };
  }
  return {
    kind: 'fertilise',
    status: 'go',
    title: { bn: 'আজ সার দেওয়া যাবে', en: 'You can apply fertiliser today' },
    reason: { bn: 'বৃষ্টির সম্ভাবনা কম।', en: 'Rain is unlikely.' },
  };
};

export const todaySignals = (w: TodayWeather): TodaySignal[] => [
  spraySignal(w),
  irrigateSignal(w),
  fertiliseSignal(w),
];

/** The three signals as one passage for reading aloud. */
export const signalsSpeech = (signals: TodaySignal[], lang: 'bn' | 'en'): string =>
  signals.map((s) => `${s.title[lang]}${lang === 'bn' ? '।' : '.'} ${s.reason[lang]}`).join(' ');

/**
 * The numbers the signals need, from the `/api/weathernext-3` response.
 * Returns null when the response has no current reading.
 */
export const todayWeatherFromFeed = (feed: any): TodayWeather | null => {
  const current = feed?.current;
  if (!current || typeof current.temperature_2m !== 'number') return null;

  const times: unknown[] = Array.isArray(feed?.hourly?.time) ? feed.hourly.time : [];
  const probs: unknown[] = Array.isArray(feed?.hourly?.precipitation_probability)
    ? feed.hourly.precipitation_probability
    : [];
  let start = times.findIndex((t) => typeof t === 'string' && t >= String(current.time || ''));
  if (start < 0) start = 0;
  const next12 = probs.slice(start, start + 12).filter((p): p is number => typeof p === 'number');

  const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const rainChanceToday = num(feed?.daily?.precipitation_probability_max?.[0]);
  const soil = feed?.agro_metrics?.soil_moisture_0_7cm;

  return {
    temp: current.temperature_2m,
    humidity: num(current.relative_humidity_2m),
    windSpeed: num(current.wind_speed_10m),
    rainChanceToday,
    rainChanceNext12h: next12.length > 0 ? Math.max(...next12) : rainChanceToday,
    soilMoisture: typeof soil === 'number' && Number.isFinite(soil) ? soil : undefined,
  };
};
