/**
 * Which line of the government price bulletin belongs to which crop, and how
 * to say it plainly.
 *
 * The Department of Agricultural Marketing (DAM) daily bulletin is a price
 * range (lowest to highest, taka per kg) seen in Dhaka markets. It is not a
 * farm-gate price, and it is not split into "wholesale" and "retail". It
 * carries onion and green chilli, and rice (not paddy); it does not carry
 * tomato, potato, brinjal, maize, mustard, jute, watermelon or betel leaf.
 *
 * Kept free of React and network code so it can be unit-tested.
 */

import type { BulletinPrice, OfficialBulletin } from '../services/marketPrices';
import { KG_PER_MON } from './seasonMath';

export interface CropBulletinLink {
  /** Commodity id in the bulletin (see netlify/functions/_shared/market-prices.ts). */
  bulletinId: string;
  /**
   * True when the bulletin line is a related product, not the crop itself
   * (rice for a paddy grower). Such a price must never be used as the
   * crop's own price.
   */
  related: boolean;
}

/**
 * Crop keys used by the Market screen, the main-crop picker and the profit
 * calculator, mapped to the bulletin.
 */
const CROP_TO_BULLETIN: Record<string, CropBulletinLink> = {
  chili: { bulletinId: 'pabna_chili', related: false },
  onion: { bulletinId: 'faridpur_onion', related: false },
  paddy: { bulletinId: 'dinajpur_rice', related: true },
  paddy_boro: { bulletinId: 'dinajpur_rice', related: true },
  paddy_aman: { bulletinId: 'dinajpur_rice', related: true },
};

export const bulletinLinkForCrop = (crop: string | null | undefined): CropBulletinLink | null =>
  (crop && CROP_TO_BULLETIN[crop.toLowerCase()]) || null;

export type CropPriceState =
  /** The bulletin carries this crop. */
  | { kind: 'official'; price: BulletinPrice; related: false; fetchedAt: string; stale: boolean }
  /** The bulletin carries a related product only (rice for paddy). */
  | { kind: 'related'; price: BulletinPrice; related: true; fetchedAt: string; stale: boolean }
  /** The bulletin does not list this crop at all. */
  | { kind: 'not_listed' }
  /** No bulletin could be loaded. */
  | { kind: 'unavailable' };

/** What the bulletin says about one crop. */
export const cropPriceFromBulletin = (
  bulletin: OfficialBulletin | null,
  crop: string | null | undefined
): CropPriceState => {
  if (!bulletin) return { kind: 'unavailable' };
  const link = bulletinLinkForCrop(crop);
  if (!link) return { kind: 'not_listed' };
  const price = bulletin.prices.find((p) => p.id === link.bulletinId);
  if (!price) return { kind: 'not_listed' };
  const base = { price, fetchedAt: bulletin.fetchedAt, stale: bulletin.stale };
  return link.related
    ? { kind: 'related', related: true, ...base }
    : { kind: 'official', related: false, ...base };
};

/** A per-kg price as a per-mon (40 kg) price. */
export const perKgToPerMon = (perKg: number): number => Math.round(perKg * KG_PER_MON);

/** "13 Nov" / "১৩ নভেম্বর", in Dhaka time. Empty string for a bad date. */
export const bulletinDateLabel = (iso: string, lang: 'bn' | 'en'): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Dhaka',
  });
};
