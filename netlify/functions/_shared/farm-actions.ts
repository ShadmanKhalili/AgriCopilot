/**
 * Farm action rules: spray, irrigate, fertilise.
 *
 * This is the ONE place where the "do / don't today" decisions live. The
 * Netlify function, the local dev server (server.ts) and the browser bundle all
 * import this file, so it must stay pure TypeScript: no imports, no Node or
 * browser APIs.
 *
 * The rules return reason CODES, not sentences. The wording (Bangla and
 * English) lives on the client in src/utils/todaySignals.ts.
 *
 * Same conditions in, same advice out. These are general field guidance and do
 * not replace the label on a product or a local officer's advice.
 */

export type ActionKind = 'spray' | 'irrigate' | 'fertilise';
export type ActionStatus = 'go' | 'wait' | 'stop';

/**
 * Stable reason codes. Add new codes at the end; never rename one, the client
 * maps them to sentences.
 */
export type ActionReason =
  /** Rain is likely (chance >= RAIN_LIKELY). spray/irrigate/fertilise: stop. */
  | 'rain_likely'
  /** Some chance of rain (>= RAIN_POSSIBLE). spray/fertilise: wait. */
  | 'rain_possible'
  /** Wind above WIND_TOO_STRONG. spray: stop. */
  | 'wind_strong'
  /** Wind above WIND_BREEZY. spray: wait. */
  | 'wind_breezy'
  /** Temperature above TOO_HOT_TO_SPRAY. spray: wait (spray when cooler). */
  | 'too_hot'
  /** Rain and wind risk both low. spray: go. */
  | 'low_risk'
  /** Rain unlikely (wind unknown for spray). spray/fertilise: go. */
  | 'rain_unlikely'
  /** Soil moisture >= SOIL_WET. irrigate: stop. */
  | 'soil_wet'
  /** Soil moisture < SOIL_DRY and rain not likely. irrigate: go. */
  | 'soil_dry'
  /** No soil reading, or soil neither wet nor dry. irrigate: wait. */
  | 'check_soil';

export const ACTION_REASONS: readonly ActionReason[] = [
  'rain_likely',
  'rain_possible',
  'wind_strong',
  'wind_breezy',
  'too_hot',
  'low_risk',
  'rain_unlikely',
  'soil_wet',
  'soil_dry',
  'check_soil',
];

/** The agreed thresholds. Do not change without agreeing the new behaviour. */
export const FARM_THRESHOLDS = {
  /** % chance of rain at which spray and fertiliser would wash off. */
  RAIN_LIKELY: 50,
  /** % chance of rain at which to wait and watch the sky. */
  RAIN_POSSIBLE: 25,
  /** km/h; above this spray is carried off the crop. */
  WIND_TOO_STRONG: 20,
  /** km/h; above this pick a calm time to spray. */
  WIND_BREEZY: 14,
  /** °C; above this spray early morning or late afternoon. */
  TOO_HOT_TO_SPRAY: 33,
  /** m³/m³ topsoil moisture; at or above this no irrigation is needed. */
  SOIL_WET: 0.35,
  /** m³/m³ topsoil moisture; below this the soil is dry. */
  SOIL_DRY: 0.22,
} as const;

export interface ActionInput {
  /** °C. For a future day, that day's maximum. Undefined when unknown: no heat check. */
  temp?: number;
  /** km/h. For a future day, that day's maximum. Undefined when unknown: no wind check. */
  windSpeed?: number;
  /** Highest chance of rain for the day, %. */
  rainChance: number;
  /** Highest chance of rain in the next hours (next 12 h for today), %. */
  rainChanceSoon?: number;
  /** %. Not used by the rules today; carried for completeness. */
  humidity?: number;
  /** Topsoil moisture, m³/m³. Undefined when there is no reading. */
  soilMoisture?: number;
}

export interface FarmAction {
  kind: ActionKind;
  status: ActionStatus;
  reason: ActionReason;
}

export interface DayActions {
  /** 'YYYY-MM-DD' as given by the feed's `daily.time`. */
  date: string;
  /** spray, irrigate, fertilise, in that order. */
  actions: FarmAction[];
  tempMax: number | null;
  tempMin: number | null;
  /** Highest chance of rain that day, %. */
  rainChance: number | null;
}

/** Today's numbers as read from the weather feed. */
export interface TodayConditions {
  temp: number;
  humidity: number;
  windSpeed: number;
  rainChanceToday: number;
  rainChanceNext12h: number;
  soilMoisture?: number;
}

export interface FeedActions {
  today: FarmAction[];
  week: DayActions[];
}

const T = FARM_THRESHOLDS;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const rainOf = (input: ActionInput): number =>
  Math.max(isNum(input.rainChance) ? input.rainChance : 0, isNum(input.rainChanceSoon) ? input.rainChanceSoon : 0);

export function sprayAction(input: ActionInput): FarmAction {
  const rain = rainOf(input);
  const wind = isNum(input.windSpeed) ? input.windSpeed : undefined;
  const temp = isNum(input.temp) ? input.temp : undefined;
  if (rain >= T.RAIN_LIKELY) return { kind: 'spray', status: 'stop', reason: 'rain_likely' };
  if (wind !== undefined && wind > T.WIND_TOO_STRONG) return { kind: 'spray', status: 'stop', reason: 'wind_strong' };
  if (rain >= T.RAIN_POSSIBLE) return { kind: 'spray', status: 'wait', reason: 'rain_possible' };
  if (wind !== undefined && wind > T.WIND_BREEZY) return { kind: 'spray', status: 'wait', reason: 'wind_breezy' };
  if (temp !== undefined && temp > T.TOO_HOT_TO_SPRAY) return { kind: 'spray', status: 'wait', reason: 'too_hot' };
  return { kind: 'spray', status: 'go', reason: wind === undefined ? 'rain_unlikely' : 'low_risk' };
}

/** °C; below this it is too cold to spray (the rules above have no cold check). */
export const TOO_COLD_TO_SPRAY = 12;

/**
 * True when one hour is a safe time to spray: the spray rule says 'go' for that
 * hour, and it is not too cold. Used for the "safe spraying window" so it can
 * never contradict the spray advice.
 */
export function isSafeSprayHour(input: { temp: number; windSpeed: number; rainChance: number }): boolean {
  if (isNum(input.temp) && input.temp < TOO_COLD_TO_SPRAY) return false;
  return sprayAction(input).status === 'go';
}

export function irrigateAction(input: ActionInput): FarmAction {
  const soil = isNum(input.soilMoisture) ? input.soilMoisture : undefined;
  if (rainOf(input) >= T.RAIN_LIKELY) return { kind: 'irrigate', status: 'stop', reason: 'rain_likely' };
  if (soil !== undefined && soil >= T.SOIL_WET) return { kind: 'irrigate', status: 'stop', reason: 'soil_wet' };
  if (soil !== undefined && soil < T.SOIL_DRY) return { kind: 'irrigate', status: 'go', reason: 'soil_dry' };
  return { kind: 'irrigate', status: 'wait', reason: 'check_soil' };
}

export function fertiliseAction(input: ActionInput): FarmAction {
  const rain = rainOf(input);
  if (rain >= T.RAIN_LIKELY) return { kind: 'fertilise', status: 'stop', reason: 'rain_likely' };
  if (rain >= T.RAIN_POSSIBLE) return { kind: 'fertilise', status: 'wait', reason: 'rain_possible' };
  return { kind: 'fertilise', status: 'go', reason: 'rain_unlikely' };
}

/** spray, irrigate, fertilise, in that order. */
export function farmActions(input: ActionInput): FarmAction[] {
  return [sprayAction(input), irrigateAction(input), fertiliseAction(input)];
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const numOr = (v: unknown, fallback: number): number => (isNum(v) ? v : fallback);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);

/**
 * Today's numbers from the `/api/weathernext-3` response. Returns null when the
 * response has no current reading.
 *
 * The next-12-hours chance looks only at hours from now on; without hourly data
 * it falls back to the day's chance.
 */
export function todayConditionsFromFeed(feed: unknown): TodayConditions | null {
  const f = feed as any;
  const current = f?.current;
  if (!current || !isNum(current.temperature_2m)) return null;

  const times = arr(f?.hourly?.time);
  const probs = arr(f?.hourly?.precipitation_probability);
  let start = times.findIndex((t) => typeof t === 'string' && t >= String(current.time || ''));
  if (start < 0) start = 0;
  const next12 = probs.slice(start, start + 12).filter(isNum);

  // "Today" means the rest of today. The daily figure covers the whole day,
  // so in the evening it would still warn about rain that fell in the morning.
  // When the hourly data covers the hours left today, use those instead.
  const dailyChance = numOr(f?.daily?.precipitation_probability_max?.[0], 0);
  const todayKey = String(current.time || '').slice(0, 10);
  const restOfToday = todayKey.length === 10
    ? probs.filter((p, i) => i >= start && typeof times[i] === 'string' && (times[i] as string).slice(0, 10) === todayKey).filter(isNum)
    : [];
  const rainChanceToday = restOfToday.length > 0 ? Math.max(...restOfToday) : dailyChance;
  const soil = f?.agro_metrics?.soil_moisture_0_7cm;

  return {
    temp: current.temperature_2m,
    humidity: numOr(current.relative_humidity_2m, 0),
    windSpeed: numOr(current.wind_speed_10m, 0),
    rainChanceToday,
    rainChanceNext12h: next12.length > 0 ? Math.max(...next12) : rainChanceToday,
    soilMoisture: isNum(soil) ? soil : undefined,
  };
}

/** The rule input for today's conditions. */
export function todayActionInput(c: TodayConditions): ActionInput {
  return {
    temp: c.temp,
    windSpeed: c.windSpeed,
    rainChance: c.rainChanceToday,
    rainChanceSoon: c.rainChanceNext12h,
    humidity: c.humidity,
    soilMoisture: c.soilMoisture,
  };
}

/** The number of days the week covers, starting today. */
export const WEEK_DAYS = 7;

/**
 * Up to 7 days starting today, from the feed's `daily` arrays.
 *
 * - Day 0 (today) uses today's full reading (current wind, next-12-hours rain,
 *   soil) when the feed has a current reading, so it always matches `today`.
 * - A later day uses that day's rain chance, max temperature and max wind
 *   (`wind_speed_10m_max`). With no wind for the day, spray is decided from rain
 *   and heat only. There is no soil reading for a later day, so irrigation
 *   follows rain only.
 * - A day with no date or no rain chance is left out: the advice would be a guess.
 */
export function weekActionsFromFeed(feed: unknown): DayActions[] {
  const f = feed as any;
  const daily = f?.daily;
  const dates = arr(daily?.time);
  if (dates.length === 0) return [];

  const rain = arr(daily?.precipitation_probability_max);
  const tMax = arr(daily?.temperature_2m_max);
  const tMin = arr(daily?.temperature_2m_min);
  const wMax = arr(daily?.wind_speed_10m_max);
  const today = todayConditionsFromFeed(feed);

  const week: DayActions[] = [];
  for (let i = 0; i < Math.min(WEEK_DAYS, dates.length); i++) {
    const date = dates[i];
    if (typeof date !== 'string' || date.length === 0) continue;
    const rainChance = numOrNull(rain[i]);
    const tempMax = numOrNull(tMax[i]);
    const tempMin = numOrNull(tMin[i]);

    let actions: FarmAction[];
    if (i === 0 && today) {
      actions = farmActions(todayActionInput(today));
    } else {
      if (rainChance === null) continue;
      actions = farmActions({
        temp: tempMax ?? undefined,
        windSpeed: numOrNull(wMax[i]) ?? undefined,
        rainChance,
      });
    }
    week.push({ date: date.slice(0, 10), actions, tempMax, tempMin, rainChance });
  }
  return week;
}

/**
 * Today's actions and the week's, from the `/api/weathernext-3` response.
 * Returns null when the response has no current reading.
 */
export function farmActionsFromFeed(feed: unknown): FeedActions | null {
  const today = todayConditionsFromFeed(feed);
  if (!today) return null;
  return { today: farmActions(todayActionInput(today)), week: weekActionsFromFeed(feed) };
}
