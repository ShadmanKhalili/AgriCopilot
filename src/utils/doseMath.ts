/**
 * The arithmetic behind the spray / dose calculator.
 *
 * Bangladeshi product labels state the rate against different volumes of
 * water: per litre, per 10 litres, or per 16 litre knapsack tank. Treating a
 * "20 ml per 10 L" label as "20 ml per litre" is a 10x overdose, so the basis
 * is an explicit input here and the amount per litre is always derived from it.
 *
 * The app never suggests a rate; `rate` is whatever the farmer read off the
 * label.
 */

export type LandUnit = 'decimal' | 'bigha' | 'acre' | 'katha';

/** The water volume the label's rate refers to, in litres. */
export type DoseBasis = 1 | 10 | 16;

export const DOSE_BASES: readonly DoseBasis[] = [10, 16, 1];
export const DEFAULT_DOSE_BASIS: DoseBasis = 10;

/**
 * Approximate spray volume for foliage coverage. It really depends on the crop
 * height, canopy and sprayer nozzle, so the UI labels it as approximate.
 */
export const WATER_LITRES_PER_DECIMAL = 10;

/** 1 bigha = 33 decimals, 1 acre = 100 decimals, 1 katha = 1.65 decimals. */
export const DECIMALS_PER_UNIT: Record<LandUnit, number> = {
  decimal: 1,
  bigha: 33,
  acre: 100,
  katha: 1.65,
};

export const toDecimals = (size: number, unit: LandUnit): number =>
  size * (DECIMALS_PER_UNIT[unit] ?? 1);

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The amount of product in one litre of spray mix. */
export const dosePerLitre = (rate: number, basisLitres: number): number | null =>
  Number.isFinite(rate) && rate > 0 && basisLitres > 0 ? rate / basisLitres : null;

/** The amount of product to put in a tank of `tankLitres` of water. */
export const dosePerTank = (rate: number, basisLitres: number, tankLitres: number): number | null =>
  Number.isFinite(rate) && rate > 0 && basisLitres > 0 && tankLitres > 0
    ? round1((rate * tankLitres) / basisLitres)
    : null;

export interface DoseInput {
  landSize: number;
  landUnit: LandUnit;
  /** The rate printed on the label, or null when the farmer has not typed one. */
  rate: number | null;
  /** The water volume the label's rate refers to. */
  basisLitres: DoseBasis;
  /** The knapsack the farmer actually uses. */
  tankLitres: number;
  /** BDT per 100 g / 100 ml, optional. */
  pricePer100?: number | null;
}

export interface DoseResult {
  decimals: number;
  totalWaterLitres: number;
  totalTanks: number;
  /** Product per litre of spray mix, unrounded. */
  perLitre: number | null;
  /** Product per tank of the farmer's sprayer. */
  perTank: number | null;
  /** Product per standard 16 L knapsack tank. */
  per16LTank: number | null;
  /** Product for the whole field, one spray round. */
  total: number | null;
  /** BDT, null unless both a rate and a price are present. */
  cost: number | null;
}

export const computeDose = (input: DoseInput): DoseResult => {
  const { landSize, landUnit, rate, basisLitres, tankLitres, pricePer100 } = input;
  const decimals = toDecimals(landSize, landUnit);
  const totalWaterLitres = Math.max(1, Math.round(decimals * WATER_LITRES_PER_DECIMAL));
  const totalTanks = Math.max(1, Math.ceil(totalWaterLitres / (tankLitres > 0 ? tankLitres : 16)));

  const hasRate = rate !== null && rate !== undefined;
  const perLitre = hasRate ? dosePerLitre(rate, basisLitres) : null;
  const total = perLitre === null ? null : round1((totalWaterLitres * rate) / basisLitres);
  const cost =
    total === null || !pricePer100 || pricePer100 <= 0
      ? null
      : Math.round((total / 100) * pricePer100);

  return {
    decimals,
    totalWaterLitres,
    totalTanks,
    perLitre,
    perTank: hasRate ? dosePerTank(rate, basisLitres, tankLitres) : null,
    per16LTank: hasRate ? dosePerTank(rate, basisLitres, 16) : null,
    total,
    cost,
  };
};
