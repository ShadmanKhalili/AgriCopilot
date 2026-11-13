/**
 * Pure helpers for the profit calculator screens: which typical crop figures
 * to start from, how a saved plan's total cost is spread back over the cost
 * items, and how numbers are read from and written for the farmer.
 *
 * No React and no storage here, so it runs in the node test environment.
 */

import { COST_ITEM_KEYS, CROP_BENCHMARKS, type CostItemKey, type CropBenchmark } from '../data/cropBenchmarks';
import type { LandUnit } from './seasonMath';
import { toBn } from './banglaNum';

export const DEFAULT_BENCHMARK_KEY = 'paddy_boro';

export const isBenchmarkKey = (key: string | null | undefined): key is string =>
  !!key && Object.prototype.hasOwnProperty.call(CROP_BENCHMARKS, key);

/** The farmer's main crop (welcome-screen id) as a calculator crop key. */
const MAIN_CROP_TO_BENCHMARK: Record<string, string> = {
  paddy: 'paddy_boro',
  rice: 'paddy_boro',
  potato: 'potato',
  tomato: 'tomato',
  onion: 'onion',
  brinjal: 'brinjal',
  chili: 'chili',
  maize: 'maize',
};

/**
 * The calculator crop to preselect for a main crop. Crops with no typical
 * figures (mustard, jute) and no main crop fall back to boro paddy.
 */
export const benchmarkKeyForMainCrop = (mainCrop: string | null | undefined): string => {
  const id = typeof mainCrop === 'string' ? mainCrop.trim().toLowerCase() : '';
  if (MAIN_CROP_TO_BENCHMARK[id]) return MAIN_CROP_TO_BENCHMARK[id];
  if (isBenchmarkKey(id)) return id;
  return DEFAULT_BENCHMARK_KEY;
};

/**
 * The crop to open the calculator on. The app shell passes `paddy_boro` when
 * nothing chose a crop, so that value alone does not override the farmer's
 * own main crop; any other valid crop (for example from another screen's
 * link) does.
 */
export const initialBenchmarkKey = (
  initialCrop: string | null | undefined,
  mainCrop: string | null | undefined
): string => {
  const linked = linkedBenchmarkKey(initialCrop);
  if (linked && String(initialCrop).trim().toLowerCase() !== DEFAULT_BENCHMARK_KEY) return linked;
  return benchmarkKeyForMainCrop(mainCrop);
};

/** The calculator crop another screen's crop id points to, or null when there is none. */
export function linkedBenchmarkKey(crop: string | null | undefined): string | null {
  const id = typeof crop === 'string' ? crop.trim().toLowerCase() : '';
  // Other screens use ids such as `paddy`, which is `paddy_boro` here.
  return MAIN_CROP_TO_BENCHMARK[id] ?? (isBenchmarkKey(id) ? id : null);
}

/** Calculator crop key as the crop id other screens use (paddy_boro -> paddy). */
export const mainCropForBenchmark = (key: string): string =>
  key === 'paddy_boro' || key === 'paddy_aman' ? 'paddy' : key;

export type CostItems = Record<CostItemKey, number> & { lease: number };

/** Typical cost items for a plot `landRatio` bighas large. */
export const typicalCostItems = (benchmark: CropBenchmark, landRatio: number): CostItems => {
  const items = { lease: 0 } as CostItems;
  for (const key of COST_ITEM_KEYS) {
    items[key] = Math.round(benchmark.perBighaCosts[key] * landRatio);
  }
  return items;
};

/**
 * Spread a saved plan's total cost over the cost items in the typical
 * proportions, so the calculator shows the same total. The items add up to
 * `total` exactly (rounding goes to the largest item). Lease is 0.
 */
export const costItemsForTotal = (benchmark: CropBenchmark, landRatio: number, total: number): CostItems => {
  const target = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  const typical = typicalCostItems(benchmark, landRatio > 0 ? landRatio : 1);
  const typicalSum = COST_ITEM_KEYS.reduce((sum, key) => sum + typical[key], 0);
  const items = { lease: 0 } as CostItems;
  if (typicalSum <= 0) {
    for (const key of COST_ITEM_KEYS) items[key] = 0;
    items.labor = target;
    return items;
  }
  let largest: CostItemKey = COST_ITEM_KEYS[0];
  let assigned = 0;
  for (const key of COST_ITEM_KEYS) {
    items[key] = Math.round((typical[key] * target) / typicalSum);
    assigned += items[key];
    if (typical[key] > typical[largest]) largest = key;
  }
  items[largest] = Math.max(0, items[largest] + (target - assigned));
  return items;
};

/**
 * Read a number the farmer typed. Accepts Bangla or Latin digits, commas
 * and a decimal point (Latin '.' or the Bangla dari is not a decimal).
 * Returns null for empty or non-numeric text.
 */
export const parseNumberInput = (text: string | null | undefined): number | null => {
  const latin = String(text ?? '')
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .replace(/[,\s৳]/g, '');
  if (!/^\d+(?:\.\d*)?$|^\.\d+$/.test(latin)) return null;
  const n = parseFloat(latin);
  return Number.isFinite(n) ? n : null;
};

/** A whole number with Indian grouping, in Bangla digits for Bangla. */
export const formatNumber = (n: number, lang: 'bn' | 'en'): string => {
  const shown = (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  return lang === 'bn' ? toBn(shown) : shown;
};

/** "৳১২,৩৪৫". Negative amounts are shown without the sign: say loss in words. */
export const formatTaka = (n: number, lang: 'bn' | 'en'): string =>
  '৳' + formatNumber(Math.abs(Math.round(Number.isFinite(n) ? n : 0)), lang);

export const LAND_UNIT_LABELS: Record<LandUnit, { bn: string; en: string }> = {
  bigha: { bn: 'বিঘা', en: 'bigha' },
  decimal: { bn: 'শতাংশ', en: 'decimal' },
  acre: { bn: 'একর', en: 'acre' },
  katha: { bn: 'কাঠা', en: 'katha' },
};

/** "1.5 bigha" / "১.৫ বিঘা". */
export const landLabel = (size: number, unit: LandUnit, lang: 'bn' | 'en'): string =>
  `${formatNumber(size, lang)} ${LAND_UNIT_LABELS[unit]?.[lang] ?? unit}`;

/** A 'YYYY-MM-DD' or ISO date as "13 Nov 2026" / "১৩ নভেম্বর ২০২৬". Empty for a bad date. */
export const shortDateLabel = (value: string, lang: 'bn' | 'en'): string => {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+06:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  });
};
