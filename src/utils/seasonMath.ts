/**
 * Pure helpers for a farmer's saved crop plans ("seasons") and the costs
 * they note down during the season. No storage and no React here, so the
 * rules can be unit-tested and shared by the service and the screens.
 */

export type LandUnit = 'decimal' | 'bigha' | 'acre' | 'katha';

/** Decimals (shotangsho) in one unit of land, as the profit calculator uses them. */
export const LAND_UNIT_DECIMALS: Record<LandUnit, number> = {
  decimal: 1,
  bigha: 33,
  acre: 100,
  katha: 1.65,
};

export const LAND_UNITS = Object.keys(LAND_UNIT_DECIMALS) as LandUnit[];

/** 1 mon (maund) = 40 kg. */
export const KG_PER_MON = 40;

export const EXPENSE_CATEGORIES = [
  'seeds',
  'fertilizer',
  'pesticide',
  'irrigation',
  'labor',
  'tillage',
  'transport',
  'lease',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, { bn: string; en: string }> = {
  seeds: { bn: 'বীজ / চারা', en: 'Seed / seedlings' },
  fertilizer: { bn: 'সার', en: 'Fertiliser' },
  pesticide: { bn: 'কীটনাশক / ছত্রাকনাশক', en: 'Pesticide / fungicide' },
  irrigation: { bn: 'সেচ', en: 'Irrigation' },
  labor: { bn: 'মজুরি', en: 'Labour' },
  tillage: { bn: 'চাষ', en: 'Ploughing' },
  transport: { bn: 'পরিবহন', en: 'Transport' },
  lease: { bn: 'জমি বর্গা / ইজারা', en: 'Land rent' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

/** Upper bounds that keep a typo from becoming a crore-taka record. */
export const MAX_AMOUNT_BDT = 10_000_000;
export const MAX_LAND_SIZE = 10_000;
export const MAX_YIELD_MON = 100_000;
export const MAX_PRICE_PER_MON = 100_000;
export const NOTE_MAX = 200;
export const CROP_KEY_MAX = 64;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CROP_KEY_RE = /^[a-z0-9_-]{1,64}$/;

/** A saved crop plan. */
export interface SeasonPlan {
  id: string;
  /** Profit-calculator crop key, e.g. `paddy_boro`, `potato`. */
  crop: string;
  landSize: number;
  landUnit: LandUnit;
  /** Expected harvest for the whole plot, in mon. */
  expectedYieldMon: number;
  /** Price the farmer expects to get, BDT per mon. */
  expectedPricePerMon: number;
  /** Planned total cost for the whole plot, BDT. */
  plannedCost: number;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type SeasonInput = Omit<SeasonPlan, 'id' | 'createdAt' | 'updatedAt'>;

/** One cost the farmer noted down. */
export interface Expense {
  id: string;
  seasonId: string;
  category: ExpenseCategory;
  /** BDT, whole taka. */
  amount: number;
  note: string;
  /** 'YYYY-MM-DD' the money was spent. */
  date: string;
  createdAt: string;
}

export type ExpenseInput = Pick<Expense, 'category' | 'amount' | 'note' | 'date'>;

const finiteIn = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The plot size in decimals. */
export const landInDecimals = (size: number, unit: LandUnit): number =>
  size * (LAND_UNIT_DECIMALS[unit] ?? 1);

/**
 * Clean a plan before it is stored. Returns null when it cannot be stored
 * (unknown crop key, no land, numbers out of range).
 */
export const normaliseSeasonInput = (input: Partial<SeasonInput>): SeasonInput | null => {
  const crop = typeof input.crop === 'string' ? input.crop.trim().toLowerCase() : '';
  if (!CROP_KEY_RE.test(crop)) return null;
  const landUnit = input.landUnit && input.landUnit in LAND_UNIT_DECIMALS ? input.landUnit : null;
  if (!landUnit) return null;
  const landSize = finiteIn(input.landSize, 0, MAX_LAND_SIZE);
  if (landSize === null || landSize <= 0) return null;
  const expectedYieldMon = finiteIn(input.expectedYieldMon, 0, MAX_YIELD_MON);
  const expectedPricePerMon = finiteIn(input.expectedPricePerMon, 0, MAX_PRICE_PER_MON);
  const plannedCost = finiteIn(input.plannedCost, 0, MAX_AMOUNT_BDT);
  if (expectedYieldMon === null || expectedPricePerMon === null || plannedCost === null) return null;
  return {
    crop,
    landSize: round1(landSize),
    landUnit,
    expectedYieldMon: round1(expectedYieldMon),
    expectedPricePerMon: Math.round(expectedPricePerMon),
    plannedCost: Math.round(plannedCost),
  };
};

/**
 * Clean a cost before it is stored. The amount must be a positive whole
 * number of taka. A missing or malformed date becomes `today`.
 */
export const normaliseExpenseInput = (input: Partial<ExpenseInput>, today: string): ExpenseInput | null => {
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(input.category as string)
    ? (input.category as ExpenseCategory)
    : null;
  if (!category) return null;
  const amount = finiteIn(input.amount, 0, MAX_AMOUNT_BDT);
  if (amount === null || Math.round(amount) <= 0) return null;
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, NOTE_MAX) : '';
  const rawDate = typeof input.date === 'string' ? input.date.trim() : '';
  const date = DATE_RE.test(rawDate) ? rawDate : today;
  return { category, amount: Math.round(amount), note, date };
};

/** Total of all noted costs, BDT. */
export const totalExpenses = (expenses: Pick<Expense, 'amount'>[]): number =>
  expenses.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);

/** Noted costs per category, only categories that have any, largest first. */
export const expenseTotalsByCategory = (
  expenses: Pick<Expense, 'amount' | 'category'>[]
): Array<{ category: ExpenseCategory; amount: number }> => {
  const totals = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    if (!Number.isFinite(e.amount)) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
};

/** Newest spend date first; createdAt breaks ties. */
export const sortExpenses = <T extends Pick<Expense, 'date' | 'createdAt'>>(list: T[]): T[] =>
  [...list].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)
  );

/** Most recently changed plan first. */
export const sortSeasons = <T extends Pick<SeasonPlan, 'updatedAt'>>(list: T[]): T[] =>
  [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/** The figures a plan gives: income, profit and the lowest price that covers cost. */
export interface PlanResult {
  income: number;
  profit: number;
  /** BDT per mon below which the farmer loses money; null with no harvest. */
  breakEvenPerMon: number | null;
}

export const planResult = (
  cost: number,
  yieldMon: number,
  pricePerMon: number
): PlanResult => {
  const income = Math.round(yieldMon * pricePerMon);
  return {
    income,
    profit: income - Math.round(cost),
    breakEvenPerMon: yieldMon > 0 ? Math.round(cost / yieldMon) : null,
  };
};
