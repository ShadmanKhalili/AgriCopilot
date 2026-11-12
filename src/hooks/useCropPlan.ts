import { useCallback, useEffect, useState } from 'react';
import type { CropPlan } from '../utils/cropCalendar';
import { CROP_PLAN_EVENT, CROP_PLAN_KEY, loadCropPlan, saveCropPlan } from '../utils/cropPlan';

/** The saved crop plan (kept on this device) and a setter that saves it and updates other screens. */
export function useCropPlan(): [CropPlan | null, (plan: CropPlan | null) => void] {
  const [plan, setPlan] = useState<CropPlan | null>(() => loadCropPlan());

  useEffect(() => {
    const refresh = () => setPlan(loadCropPlan());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === CROP_PLAN_KEY) refresh();
    };
    refresh();
    window.addEventListener(CROP_PLAN_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CROP_PLAN_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((next: CropPlan | null) => {
    setPlan(next);
    saveCropPlan(next);
  }, []);

  return [plan, update];
}
