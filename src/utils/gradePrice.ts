/**
 * Price wording for the produce grading screen.
 *
 * The price the AI returns is a rough guess with no data behind it. These
 * helpers keep it as a range, and link a graded product to the government
 * price bulletin only where the bulletin really carries that product.
 * Free of React and network code so it can be unit-tested.
 */

/**
 * Grading product key -> crop key understood by `cropPriceFromBulletin`.
 * Only products the bulletin can carry are mapped. Everything else (tomato,
 * brinjal, mango, banana, fish, salt...) returns null: no government price.
 */
const PRODUCE_TO_CROP: Record<string, string> = {
  chili: 'chili',
  greenChili: 'chili',
  onion: 'onion',
};

export const cropKeyForProduce = (produce: string | null | undefined): string | null =>
  (produce && PRODUCE_TO_CROP[produce]) || null;

export interface PriceEstimate {
  low: number;
  high: number;
  /** True when low and high differ. */
  isRange: boolean;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * The AI's price as a low-high range. Uses the range fields when they are
 * usable, otherwise the single figure. Returns null when there is no usable
 * number, so the screen shows no price rather than "0".
 */
export const priceEstimateRange = (r: {
  estimatedPriceBdt?: unknown;
  estimatedPriceLowBdt?: unknown;
  estimatedPriceHighBdt?: unknown;
}): PriceEstimate | null => {
  if (finite(r.estimatedPriceLowBdt) && finite(r.estimatedPriceHighBdt) && r.estimatedPriceHighBdt > 0) {
    const low = Math.round(Math.min(r.estimatedPriceLowBdt, r.estimatedPriceHighBdt));
    const high = Math.round(Math.max(r.estimatedPriceLowBdt, r.estimatedPriceHighBdt));
    return { low, high, isRange: low !== high };
  }
  if (finite(r.estimatedPriceBdt) && r.estimatedPriceBdt > 0) {
    const v = Math.round(r.estimatedPriceBdt);
    return { low: v, high: v, isRange: false };
  }
  return null;
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const num = (n: number, lang: 'bn' | 'en') =>
  lang === 'bn' ? String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : String(n);

/** "৳৪০–৬০" or "৳40" (no unit). */
export const formatEstimate = (e: PriceEstimate, lang: 'bn' | 'en'): string =>
  e.isRange ? `৳${num(e.low, lang)}–${num(e.high, lang)}` : `৳${num(e.low, lang)}`;

/** "৳40–60 per kg (AI estimate)" for messages and the certificate. */
export const estimateLine = (e: PriceEstimate | null, lang: 'bn' | 'en'): string => {
  if (!e) return lang === 'bn' ? 'দাম: অনুমান নেই' : 'Price: no estimate';
  const p = formatEstimate(e, lang);
  return lang === 'bn' ? `${p}/কেজি (এআই-এর অনুমান)` : `${p}/kg (AI estimate)`;
};
