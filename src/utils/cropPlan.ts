import type { CropPlan } from './cropCalendar';

export const CROP_PLAN_KEY = 'krishi_crop_plan';
export const CROP_PLAN_EVENT = 'krishi-crop-plan';

/** True only for a well-formed plan. */
export function isValidCropPlan(value: unknown): value is CropPlan {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.cropKey !== 'string' || v.cropKey.length === 0) return false;
  if (typeof v.sowingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.sowingDate)) return false;
  if (Number.isNaN(Date.parse(v.sowingDate))) return false;
  if (!Array.isArray(v.completedStages)) return false;
  return v.completedStages.every((n) => Number.isInteger(n) && (n as number) >= 0);
}

export function loadCropPlan(): CropPlan | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CROP_PLAN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidCropPlan(parsed)) return null;
    return {
      cropKey: parsed.cropKey,
      sowingDate: parsed.sowingDate,
      completedStages: Array.from(new Set(parsed.completedStages)).sort((a, b) => a - b),
    };
  } catch {
    return null;
  }
}

export function saveCropPlan(plan: CropPlan | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (plan === null) localStorage.removeItem(CROP_PLAN_KEY);
      else localStorage.setItem(CROP_PLAN_KEY, JSON.stringify(plan));
    }
  } catch {
    // storage unavailable or full: keep going, the screen still shows the plan
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event !== 'undefined') {
      window.dispatchEvent(new Event(CROP_PLAN_EVENT));
    }
  } catch {
    // ignore
  }
}

/** Pure: returns a new plan with the stage ticked or unticked. */
export function toggleStageDone(plan: CropPlan, stageIndex: number): CropPlan {
  const has = plan.completedStages.includes(stageIndex);
  const completedStages = has
    ? plan.completedStages.filter((i) => i !== stageIndex)
    : [...plan.completedStages, stageIndex].sort((a, b) => a - b);
  return { ...plan, completedStages };
}
