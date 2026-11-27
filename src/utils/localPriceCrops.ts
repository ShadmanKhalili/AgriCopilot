/**
 * The crop names farmers use when they report, and read, a local sale price.
 *
 * The Market screen has its own crop keys (`betelLeaf`). Area reports are
 * stored under a plain lower-case slug, so every farmer's report for the same
 * crop lands in the same list. Paddy stays paddy (not rice): a farmer sells
 * paddy by the mon, and a rice price would be a different number.
 *
 * Kept free of React and network code so it can be unit-tested.
 */

import { KG_PER_MON } from './seasonMath';

/** Market-screen crop key -> the slug used in area reports. */
export const LOCAL_PRICE_CROPS: Record<string, string> = {
  tomato: 'tomato',
  brinjal: 'brinjal',
  paddy: 'paddy',
  betelLeaf: 'betel_leaf',
  chili: 'chili',
  watermelon: 'watermelon',
  potato: 'potato',
  onion: 'onion',
};

/** The report slug for a Market-screen crop, or null when the crop is not known. */
export const localPriceCrop = (marketKey: string | null | undefined): string | null =>
  marketKey && Object.prototype.hasOwnProperty.call(LOCAL_PRICE_CROPS, marketKey)
    ? LOCAL_PRICE_CROPS[marketKey]
    : null;

export type PriceUnit = 'mon' | 'kg';

/**
 * A price the farmer typed, as taka per mon (40 kg). Per-kg prices are
 * multiplied by 40. Null when the input is not a positive number.
 */
export const toPricePerMon = (value: number | null | undefined, unit: PriceUnit): number | null => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return unit === 'kg' ? Math.round(value * KG_PER_MON) : Math.round(value);
};
