/**
 * Daytime rule for the "safe spraying window".
 *
 * A window must never fall at night (for example 12 AM to 2 AM), even when the
 * wind and rain are calm. An hour counts only when it starts between 6 AM and
 * 6 PM Bangladesh time, so a three-hour window ends by 7 PM at the latest.
 *
 * Shared by the Netlify weather function, the local dev server and the browser,
 * so keep it free of Node and browser APIs (Intl is fine).
 */

import { isSafeSprayHour } from './farm-actions.ts';

/** First hour (Dhaka local, 24 h clock) in which spraying may start. */
export const SPRAY_FIRST_HOUR = 6;
/** Last hour (Dhaka local) in which a window hour may start; that hour ends at 19:00. */
export const SPRAY_LAST_HOUR = 18;

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * The local clock hour (0-23) of a forecast time, or null when unreadable.
 * A time without a zone, such as Open-Meteo's '2026-11-12T14:00', is already
 * local to the requested zone and is read as written. A time with a zone (Z or
 * an offset), a Date or a number is converted to `timeZone`.
 */
export function localHourOf(time: unknown, timeZone: string = 'Asia/Dhaka'): number | null {
  if (typeof time === 'string') {
    const m = LOCAL_TIME.exec(time);
    if (m) return Number(m[1]);
  }
  if (time === null || time === undefined || time === '') return null;
  const d = time instanceof Date ? time : new Date(time as string | number);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(d));
    return Number.isFinite(h) ? h % 24 : null;
  } catch {
    return null;
  }
}

/** True for an hour of the day in which spraying may take place (6 AM to 6:59 PM). */
export function isDaylightSprayHour(hour: number | null | undefined): boolean {
  return typeof hour === 'number' && Number.isFinite(hour) && hour >= SPRAY_FIRST_HOUR && hour <= SPRAY_LAST_HOUR;
}

/**
 * True when this forecast hour can be part of the safe spraying window: it is
 * daytime in Bangladesh, the feed does not say it is dark, and the shared spray
 * rule says go (a missing wind or rain reading is never safe).
 */
export function isSafeSprayWindowHour(input: {
  time: unknown;
  temp: number;
  windSpeed?: number | null;
  rainChance?: number | null;
  /** The feed's own day/night flag, when it has one. */
  isDaytime?: boolean | null;
}): boolean {
  if (input.isDaytime === false) return false;
  if (!isDaylightSprayHour(localHourOf(input.time))) return false;
  return isSafeSprayHour({ temp: input.temp, windSpeed: input.windSpeed, rainChance: input.rainChance });
}
