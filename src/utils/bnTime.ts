import toBn from './banglaNum';

/**
 * Times of day the way a farmer says them: "সকাল ৬টা", "বিকাল ৩টা", "রাত ৯টা".
 * In English they read "6 AM". Nothing here depends on the phone's language
 * setting, so the same time always reads the same way.
 */

/** The part of the day for an hour (0-23), as Bangla speakers name it. */
export const dayPartBn = (hour24: number): string => {
  if (hour24 >= 4 && hour24 < 6) return 'ভোর';
  if (hour24 >= 6 && hour24 < 12) return 'সকাল';
  if (hour24 >= 12 && hour24 < 15) return 'দুপুর';
  if (hour24 >= 15 && hour24 < 18) return 'বিকাল';
  if (hour24 >= 18 && hour24 < 20) return 'সন্ধ্যা';
  return 'রাত';
};

const to12 = (hour24: number): number => (hour24 % 12 === 0 ? 12 : hour24 % 12);

/** "সকাল ৬টা" on the hour, "সকাল ৬:৩০" otherwise; "6 AM" / "6:30 AM" in English. */
export const clockLabel = (hour24: number, minute: number, bn: boolean): string => {
  const h = to12(hour24);
  if (bn) {
    return minute === 0
      ? `${dayPartBn(hour24)} ${toBn(h)}টা`
      : `${dayPartBn(hour24)} ${toBn(`${h}:${String(minute).padStart(2, '0')}`)}`;
  }
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  return minute === 0 ? `${h} ${suffix}` : `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
};

/**
 * The hour and minute in a forecast time. A time with no zone ("2026-11-28T06:00",
 * what the forecast gives for the farm's own area) is read as it is written. A
 * time with a zone (UTC "Z") is shown in Bangladesh time. A Date or a number of
 * milliseconds is shown in the phone's own time.
 */
export const clockParts = (raw: string | number | Date | null | undefined): { hour: number; minute: number } | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw.trim())) {
    const m = raw.match(/[T ](\d{2}):(\d{2})/);
    if (m) return { hour: Number(m[1]), minute: Number(m[2]) };
  }
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  if (typeof raw === 'string') {
    // Bangladesh is UTC+6 all year.
    const dhaka = new Date(date.getTime() + 6 * 3600000);
    return { hour: dhaka.getUTCHours(), minute: dhaka.getUTCMinutes() };
  }
  return { hour: date.getHours(), minute: date.getMinutes() };
};

/** A time of day from a forecast time or a timestamp, or null when it cannot be read. */
export const timeLabel = (raw: string | number | Date | null | undefined, bn: boolean): string | null => {
  const parts = clockParts(raw);
  return parts ? clockLabel(parts.hour, parts.minute, bn) : null;
};
