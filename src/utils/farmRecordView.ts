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
  /** 'no_costs' = something was sold but no costs are noted, so there is no profit to show. Null until something is sold. */
  tone: 'profit' | 'loss' | 'no_costs' | null;
  /** "Profit" / "Loss" / "Income" word; empty until something is sold. */
  word: string;
  /** Amount without a sign; empty until something is sold. */
  amount: string;
  /** The whole line, e.g. "Profit ৳4,000" or "Income ৳4,000 — no costs noted yet"; empty until something is sold. */
  text: string;
}

const NO_PROFIT: ProfitView = { tone: null, word: '', amount: '', text: '' };

/**
 * Profit or loss in words (the sign is never shown alone). Nothing until
 * something is sold. When there is income but no costs are noted, it says so
 * instead of calling the whole income a profit.
 */
export const profitView = (
  totals: Pick<SeasonTotals, 'profit'> & Partial<Pick<SeasonTotals, 'revenue' | 'costCount'>>,
  lang: Lang
): ProfitView => {
  if (totals.profit === null || !Number.isFinite(totals.profit)) {
    if (totals.profit === null && totals.costCount === 0 && (totals.revenue ?? 0) > 0) {
      const amount = takaText(totals.revenue as number, lang);
      const word = lang === 'bn' ? 'আয়' : 'Income';
      const note = lang === 'bn' ? 'খরচ এখনো লেখা হয়নি' : 'no costs noted yet';
      return { tone: 'no_costs', word, amount, text: `${word} ${amount} — ${note}` };
    }
    return NO_PROFIT;
  }
  const gain = totals.profit >= 0;
  const word = gain ? (lang === 'bn' ? 'লাভ' : 'Profit') : lang === 'bn' ? 'ক্ষতি' : 'Loss';
  const amount = takaText(totals.profit, lang);
  return { tone: gain ? 'profit' : 'loss', word, amount, text: `${word} ${amount}` };
};

/**
 * Sum of every season's figures, for the totals row.
 *
 * Profit adds up only seasons that have both a sale and at least one cost
 * noted (those are the only ones with a profit). A season that sold but has no
 * costs noted adds nothing to profit: its income is reported separately in
 * `incomeWithoutCosts`, so the totals never turn missing costs into profit.
 */
export const recordTotals = (
  seasons: Array<{ totals: SeasonTotals; harvestMon?: number }>
): {
  costTotal: number;
  costCount: number;
  revenue: number;
  soldMon: number;
  harvestMon: number;
  profit: number | null;
  incomeWithoutCosts: number;
} => {
  let costTotal = 0;
  let costCount = 0;
  let revenue = 0;
  let soldMon = 0;
  let harvestMon = 0;
  let incomeWithoutCosts = 0;
  let profit: number | null = null;
  for (const s of seasons) {
    costTotal += s.totals.costTotal;
    costCount += s.totals.costCount;
    revenue += s.totals.revenue;
    soldMon += s.totals.soldMon;
    harvestMon += s.harvestMon ?? 0;
    if (s.totals.profit !== null) profit = (profit ?? 0) + s.totals.profit;
    else if (s.totals.costCount === 0 && s.totals.revenue > 0) incomeWithoutCosts += s.totals.revenue;
  }
  return {
    costTotal,
    costCount,
    revenue,
    soldMon: Math.round(soldMon * 100) / 100,
    harvestMon: Math.round(harvestMon * 100) / 100,
    profit,
    incomeWithoutCosts,
  };
};
