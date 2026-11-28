/**
 * Pure helpers for showing the farm record (Phase 7), used by both the
 * on-screen section and the printed page. No React, no storage.
 */

import { CROP_BENCHMARKS } from '../data/cropBenchmarks';
import type { Plot, SeasonStage, SeasonTotals } from '../../netlify/functions/_shared/farm-record-model';
import { formatNumber, formatTaka, landLabel, shortDateLabel } from './profitPlan';

type Lang = 'bn' | 'en';

export const STAGE_LABELS: Record<SeasonStage, { bn: string; en: string }> = {
  planned: { bn: 'পরিকল্পনা', en: 'Planned' },
  growing: { bn: 'মাঠে আছে', en: 'Growing' },
  harvested: { bn: 'কাটা হয়েছে', en: 'Harvested' },
};

/** The crop's name and picture from the calculator's crop key. Unknown keys show as typed. */
export const cropDisplay = (key: string, lang: Lang): { name: string; emoji: string } => {
  const crop = Object.prototype.hasOwnProperty.call(CROP_BENCHMARKS, key) ? CROP_BENCHMARKS[key] : undefined;
  return { name: crop ? (lang === 'bn' ? crop.shortBn : crop.shortEn) : key, emoji: crop?.emoji ?? '🌱' };
};

/** "1.5 bigha" / "১.৫ বিঘা". */
export const plotSizeText = (plot: Pick<Plot, 'landSize' | 'landUnit'>, lang: Lang): string =>
  landLabel(plot.landSize, plot.landUnit, lang);

/** The plot's own name for a season's plotId, or '' when the season has no plot (or it was deleted). */
export const plotNameFor = (plots: Array<Pick<Plot, 'id' | 'name'>>, plotId: string | undefined): string =>
  (plotId && plots.find((p) => p.id === plotId)?.name) || '';

/** "1.5 mon" / "১.৫ মণ". */
export const monText = (mon: number, lang: Lang): string => `${formatNumber(mon, lang)} ${lang === 'bn' ? 'মণ' : 'mon'}`;

/** "৳১২,৩৪৫" (no sign). */
export const takaText = (n: number, lang: Lang): string => formatTaka(n, lang);

/** "13 Nov 2026" / "১৩ নভেম্বর ২০২৬"; the fallback (default '-') for a missing or bad date. */
export const dayText = (value: string | undefined, lang: Lang, fallback = '-'): string =>
  (value && shortDateLabel(value, lang)) || fallback;

export interface ProfitView {
  /** Null until something is sold. */
  tone: 'profit' | 'loss' | null;
  /** "Profit" / "Loss" word; empty until something is sold. */
  word: string;
  /** Amount without a sign; empty until something is sold. */
  amount: string;
}

/** Profit or loss in words (the sign is never shown alone). Nothing until something is sold. */
export const profitView = (totals: Pick<SeasonTotals, 'profit'>, lang: Lang): ProfitView => {
  if (totals.profit === null || !Number.isFinite(totals.profit)) return { tone: null, word: '', amount: '' };
  const gain = totals.profit >= 0;
  return {
    tone: gain ? 'profit' : 'loss',
    word: gain ? (lang === 'bn' ? 'লাভ' : 'Profit') : lang === 'bn' ? 'ক্ষতি' : 'Loss',
    amount: takaText(totals.profit, lang),
  };
};

/** Sum of every season's figures, for the totals row. Profit counts only seasons with a sale. */
export const recordTotals = (
  seasons: Array<{ totals: SeasonTotals; harvestMon?: number }>
): { costTotal: number; revenue: number; soldMon: number; harvestMon: number; profit: number | null } => {
  let costTotal = 0;
  let revenue = 0;
  let soldMon = 0;
  let harvestMon = 0;
  let profit: number | null = null;
  for (const s of seasons) {
    costTotal += s.totals.costTotal;
    revenue += s.totals.revenue;
    soldMon += s.totals.soldMon;
    harvestMon += s.harvestMon ?? 0;
    if (s.totals.profit !== null) profit = (profit ?? 0) + s.totals.profit;
  }
  return {
    costTotal,
    revenue,
    soldMon: Math.round(soldMon * 100) / 100,
    harvestMon: Math.round(harvestMon * 100) / 100,
    profit,
  };
};
