/**
 * Phase 7: the farm record. Shared shapes, checks and the record score.
 * Pure: no network, no storage. The browser, the server and the tests all use
 * this file, so the screens and the server always agree.
 *
 * Firestore layout (signed in; the security rules match these shapes):
 *   users/{uid}/plots/{plotId}                       a piece of land
 *   users/{uid}/seasons/{seasonId}                   a crop on a plot (Phase 4 plan + Phase 7 fields)
 *   users/{uid}/seasons/{seasonId}/expenses/{id}     costs (Phase 4)
 *   users/{uid}/seasons/{seasonId}/sales/{saleId}    what was sold, to whom, at what price
 *   farm_record_scores/{uid}                         written by the server only
 *
 * The record score says how complete and regular a farmer's own record is.
 * It is NOT a credit score: everything in it is typed by the farmer and
 * checked by nobody. It is calculated on the server so the farmer cannot
 * type the number itself, and the screens must say what it is.
 */

export type LandUnit = 'decimal' | 'bigha' | 'acre' | 'katha';
export const LAND_UNITS: LandUnit[] = ['decimal', 'bigha', 'acre', 'katha'];
/** Decimals (shotangsho) in one unit of land; same table as utils/seasonMath.ts. */
export const DECIMALS_PER_UNIT: Record<LandUnit, number> = { decimal: 1, bigha: 33, acre: 100, katha: 1.65 };

export const PLOT_LIMIT = 20;
export const SALE_LIMIT = 50;
export const PLOT_NAME_MAX = 60;
export const MAX_LAND_SIZE = 10_000;
export const MAX_QUANTITY_MON = 100_000;
export const MAX_PRICE_PER_MON = 100_000;

// ---------------------------------------------------------------------------
// Plots
// ---------------------------------------------------------------------------

export type Tenure = 'own' | 'lease' | 'sharecrop';
export const TENURES: Tenure[] = ['own', 'lease', 'sharecrop'];
export const TENURE_LABELS: Record<Tenure, { bn: string; en: string }> = {
  own: { bn: 'নিজের জমি', en: 'Own land' },
  lease: { bn: 'ইজারা / লিজ', en: 'Leased' },
  sharecrop: { bn: 'বর্গা', en: 'Sharecropped' },
};

export interface Plot {
  id: string;
  /** The farmer's own name for it, e.g. "বাড়ির পাশের জমি". */
  name: string;
  landSize: number;
  landUnit: LandUnit;
  tenure: Tenure;
  createdAt: string;
  updatedAt: string;
}
export type PlotInput = Pick<Plot, 'name' | 'landSize' | 'landUnit' | 'tenure'>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (value: unknown): value is string => typeof value === 'string' && DATE_RE.test(value);

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value));

/** Check and tidy a plot. Null when it is not believable. */
export const cleanPlotInput = (input: any): PlotInput | null => {
  if (!input || typeof input !== 'object') return null;
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, PLOT_NAME_MAX);
  const landSize = Math.round(num(input.landSize) * 100) / 100;
  if (!name || !Number.isFinite(landSize) || landSize <= 0 || landSize > MAX_LAND_SIZE) return null;
  if (!LAND_UNITS.includes(input.landUnit) || !TENURES.includes(input.tenure)) return null;
  return { name, landSize, landUnit: input.landUnit, tenure: input.tenure };
};

export const plotDecimals = (plot: Pick<Plot, 'landSize' | 'landUnit'>): number =>
  plot.landSize * (DECIMALS_PER_UNIT[plot.landUnit] ?? 1);

// ---------------------------------------------------------------------------
// Season progress (added to the Phase 4 season document; all optional)
// ---------------------------------------------------------------------------

export type SeasonStage = 'planned' | 'growing' | 'harvested';
export const SEASON_STAGES: SeasonStage[] = ['planned', 'growing', 'harvested'];

export interface SeasonProgress {
  plotId?: string;
  stage?: SeasonStage;
  sowingDate?: string;
  harvestDate?: string;
  /** Actual harvest for the whole plot, in mon. */
  harvestMon?: number;
}

/** Progress fields the farmer can clear: sending `null` removes the field. */
export const CLEARABLE_PROGRESS_KEYS = ['sowingDate', 'harvestDate', 'harvestMon'] as const;
export type ClearableProgressKey = (typeof CLEARABLE_PROGRESS_KEYS)[number];

/** A progress change: a value sets the field, `null` clears it (only for the clearable keys). */
export type SeasonProgressChange = {
  [K in keyof SeasonProgress]?: K extends ClearableProgressKey ? SeasonProgress[K] | null : SeasonProgress[K];
};

/** Check and tidy season progress fields. Fields that are wrong are dropped, never guessed. */
export const cleanSeasonProgress = (input: any): SeasonProgress => {
  const out: SeasonProgress = {};
  if (!input || typeof input !== 'object') return out;
  if (typeof input.plotId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(input.plotId)) out.plotId = input.plotId;
  if (SEASON_STAGES.includes(input.stage)) out.stage = input.stage;
  if (isDay(input.sowingDate)) out.sowingDate = input.sowingDate;
  if (isDay(input.harvestDate)) out.harvestDate = input.harvestDate;
  const harvest = Math.round(num(input.harvestMon) * 100) / 100;
  if (input.harvestMon !== undefined && input.harvestMon !== null && Number.isFinite(harvest) && harvest >= 0 && harvest <= MAX_QUANTITY_MON) {
    out.harvestMon = harvest;
  }
  if (out.sowingDate && out.harvestDate && out.harvestDate < out.sowingDate) delete out.harvestDate;
  return out;
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export type BuyerType = 'trader' | 'market' | 'cooperative' | 'company' | 'other';
export const BUYER_TYPES: BuyerType[] = ['trader', 'market', 'cooperative', 'company', 'other'];
export const BUYER_LABELS: Record<BuyerType, { bn: string; en: string }> = {
  trader: { bn: 'ফড়িয়া / পাইকার', en: 'Trader' },
  market: { bn: 'হাটে নিজে', en: 'Sold at the market myself' },
  cooperative: { bn: 'সমবায়', en: 'Cooperative' },
  company: { bn: 'কোম্পানি', en: 'Company' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

export interface Sale {
  id: string;
  seasonId: string;
  quantityMon: number;
  pricePerMon: number;
  buyerType: BuyerType;
  date: string;
  createdAt: string;
}
export type SaleInput = Pick<Sale, 'quantityMon' | 'pricePerMon' | 'buyerType' | 'date'>;

/** Check and tidy a sale. Null when it is not believable. `today` stops future dates. */
export const cleanSaleInput = (input: any, today: string): SaleInput | null => {
  if (!input || typeof input !== 'object') return null;
  const quantityMon = Math.round(num(input.quantityMon) * 100) / 100;
  const pricePerMon = Math.round(num(input.pricePerMon));
  if (!Number.isFinite(quantityMon) || quantityMon <= 0 || quantityMon > MAX_QUANTITY_MON) return null;
  if (!Number.isFinite(pricePerMon) || pricePerMon < 1 || pricePerMon > MAX_PRICE_PER_MON) return null;
  if (!BUYER_TYPES.includes(input.buyerType)) return null;
  if (!isDay(input.date) || input.date > today) return null;
  return { quantityMon, pricePerMon, buyerType: input.buyerType, date: input.date };
};

// ---------------------------------------------------------------------------
// Season totals (what the record and the printed page show)
// ---------------------------------------------------------------------------

export interface SeasonTotals {
  costTotal: number;
  costCount: number;
  soldMon: number;
  revenue: number;
  /** Revenue minus recorded costs. Null until something is sold AND at least one cost is noted. */
  profit: number | null;
  /** Average sale price, BDT per mon. Null until something is sold. */
  avgPricePerMon: number | null;
}

export const seasonTotals = (
  expenses: Array<{ amount: number }>,
  sales: Array<Pick<Sale, 'quantityMon' | 'pricePerMon'>>
): SeasonTotals => {
  const costTotal = expenses.reduce((sum, e) => sum + (Number.isFinite(e?.amount) ? e.amount : 0), 0);
  const soldMon = Math.round(sales.reduce((sum, s) => sum + s.quantityMon, 0) * 100) / 100;
  const revenue = Math.round(sales.reduce((sum, s) => sum + s.quantityMon * s.pricePerMon, 0));
  return {
    costTotal,
    costCount: expenses.length,
    soldMon,
    revenue,
    // No costs noted means the farmer has not told us the costs, not that
    // they were zero: showing the whole income as "profit" would be wrong.
    profit: sales.length && expenses.length ? revenue - costTotal : null,
    avgPricePerMon: soldMon > 0 ? Math.round(revenue / soldMon) : null,
  };
};

// ---------------------------------------------------------------------------
// Record score (calculated on the server; shown by the app)
// ---------------------------------------------------------------------------

/** What the server counts from the farmer's own data before scoring. */
export interface FarmRecordFacts {
  plots: number;
  totalLandDecimals: number;
  seasons: number;
  /** Seasons with at least 3 costs noted. */
  seasonsWithCosts: number;
  /** Seasons with an actual harvest amount. */
  seasonsWithHarvest: number;
  /** Seasons with at least one sale. */
  seasonsWithSales: number;
  /** Different calendar months (last 12) with a cost, sale or crop check. */
  activeMonths: number;
  /** Photo crop checks saved in the last 12 months. */
  cropChecks: number;
}

export type RecordPillarKey = 'land' | 'costs' | 'harvest' | 'sales' | 'regularity' | 'cropCare';

export interface RecordPillar {
  key: RecordPillarKey;
  points: number;
  max: number;
}

export type RecordLevel = 'starting' | 'building' | 'good' | 'strong';

export interface RecordScore {
  score: number;
  level: RecordLevel;
  pillars: RecordPillar[];
}

export const RECORD_SCORE_VERSION = 1;

export const RECORD_PILLAR_LABELS: Record<RecordPillarKey, { bn: string; en: string; howBn: string; howEn: string }> = {
  land: { bn: 'জমির তথ্য', en: 'Land', howBn: 'আপনার জমি যোগ করুন', howEn: 'Add your plots' },
  costs: { bn: 'খরচের হিসাব', en: 'Costs', howBn: 'প্রতি মৌসুমে খরচ লিখে রাখুন', howEn: 'Note costs each season' },
  harvest: { bn: 'ফলন', en: 'Harvest', howBn: 'কত মণ ফসল পেলেন লিখুন', howEn: 'Record how much you harvested' },
  sales: { bn: 'বিক্রি', en: 'Sales', howBn: 'কত দামে বিক্রি করলেন লিখুন', howEn: 'Record what you sold' },
  regularity: { bn: 'নিয়মিত ব্যবহার', en: 'Regular use', howBn: 'প্রতি মাসে কিছু লিখে রাখুন', howEn: 'Record something every month' },
  cropCare: { bn: 'ফসলের যত্ন', en: 'Crop care', howBn: 'ছবি তুলে ফসল পরীক্ষা করুন', howEn: 'Check your crop with a photo' },
};

export const RECORD_LEVEL_LABELS: Record<RecordLevel, { bn: string; en: string }> = {
  starting: { bn: 'শুরু', en: 'Starting' },
  building: { bn: 'গড়ে উঠছে', en: 'Building' },
  good: { bn: 'ভালো', en: 'Good' },
  strong: { bn: 'খুব ভালো', en: 'Strong' },
};

const clampCount = (value: unknown, max = 10_000): number => {
  const n = Math.floor(num(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

/** Score a farm record, 0-100. Same facts, same score, always. */
export const scoreFarmRecord = (raw: Partial<FarmRecordFacts>): RecordScore => {
  const f = {
    plots: clampCount(raw.plots),
    totalLandDecimals: Math.max(0, Number.isFinite(num(raw.totalLandDecimals)) ? num(raw.totalLandDecimals) : 0),
    seasonsWithCosts: clampCount(raw.seasonsWithCosts),
    seasonsWithHarvest: clampCount(raw.seasonsWithHarvest),
    seasonsWithSales: clampCount(raw.seasonsWithSales),
    activeMonths: clampCount(raw.activeMonths, 12),
    cropChecks: clampCount(raw.cropChecks),
  };
  const pillars: RecordPillar[] = [
    { key: 'land', max: 15, points: (f.plots > 0 ? 10 : 0) + (f.totalLandDecimals > 0 ? 5 : 0) },
    { key: 'costs', max: 25, points: Math.min(25, f.seasonsWithCosts * 10) },
    { key: 'harvest', max: 15, points: Math.min(15, f.seasonsWithHarvest * 8) },
    { key: 'sales', max: 15, points: Math.min(15, f.seasonsWithSales * 8) },
    { key: 'regularity', max: 20, points: Math.min(20, f.activeMonths * 2) },
    { key: 'cropCare', max: 10, points: Math.min(10, f.cropChecks * 2) },
  ].map((p) => ({ ...p, points: Math.min(p.max, p.points) })) as RecordPillar[];
  const score = Math.min(100, pillars.reduce((sum, p) => sum + p.points, 0));
  const level: RecordLevel = score >= 75 ? 'strong' : score >= 50 ? 'good' : score >= 25 ? 'building' : 'starting';
  return { score, level, pillars };
};

/** What `farm_record_scores/{uid}` holds. */
export interface StoredRecordScore extends RecordScore {
  uid: string;
  facts: FarmRecordFacts;
  /** ISO time the server calculated it. */
  computedAt: string;
  version: number;
}

/** Fewest minutes between two recalculations for one farmer. */
export const RECORD_SCORE_MIN_INTERVAL_MIN = 10;
