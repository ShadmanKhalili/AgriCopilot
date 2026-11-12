import { CROP_SCHEDULES } from '../data/cropCalendars';

export interface CropPlan {
  cropKey: string;
  sowingDate: string; // 'YYYY-MM-DD'
  completedStages: number[]; // stage indexes
}

export interface CalendarTask {
  cropKey: string;
  stageIndex: number;
  title: { bn: string; en: string };
  detail: { bn: string; en: string };
  dueDate: string; // 'YYYY-MM-DD'
  daysFromToday: number; // negative = overdue
  done: boolean;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse 'YYYY-MM-DD' to a UTC day number (days since epoch), or null if invalid. */
function parseDay(str: string): number | null {
  if (typeof str !== 'string') return null;
  const m = DATE_RE.exec(str);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return ms / DAY_MS;
}

function formatDay(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

export function hasCalendar(cropKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(CROP_SCHEDULES, cropKey);
}

/** Every stage of the plan with its date. Empty when the crop has no calendar or the date is invalid. */
export function planTimeline(plan: CropPlan, todayStr: string): CalendarTask[] {
  if (!plan || !hasCalendar(plan.cropKey)) return [];
  const sow = parseDay(plan.sowingDate);
  const today = parseDay(todayStr);
  if (sow === null || today === null) return [];
  const done = new Set(plan.completedStages ?? []);
  return CROP_SCHEDULES[plan.cropKey].stages.map((stage, stageIndex) => {
    const due = sow + stage.day - 1; // day 1 = sowing day
    return {
      cropKey: plan.cropKey,
      stageIndex,
      title: { bn: stage.stageNameBn, en: stage.stageNameEn },
      detail: { bn: stage.actionBn, en: stage.actionEn },
      dueDate: formatDay(due),
      daysFromToday: due - today,
      done: done.has(stageIndex),
    };
  });
}

/** Stages not done that are overdue by at most `overdueDays` (default 7) or due within `aheadDays` (default 7), soonest first. */
export function upcomingCalendarTasks(
  plan: CropPlan,
  todayStr: string,
  opts: { aheadDays?: number; overdueDays?: number } = {},
): CalendarTask[] {
  const ahead = opts.aheadDays ?? 7;
  const overdue = opts.overdueDays ?? 7;
  return planTimeline(plan, todayStr)
    .filter((t) => !t.done && t.daysFromToday <= ahead && t.daysFromToday >= -overdue)
    .sort((a, b) => a.daysFromToday - b.daysFromToday || a.stageIndex - b.stageIndex);
}
