import React from 'react';
import { Landmark } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { OfficialBulletin } from '../../services/marketPrices';
import { bulletinDateLabel, cropPriceFromBulletin, perKgToPerMon } from '../../utils/marketPriceView';
import { formatNumber } from '../../utils/profitPlan';

interface Props {
  lang: Language;
  cropKey: string;
  bulletin: OfficialBulletin | null;
  className?: string;
}

/**
 * The government's Dhaka market price for this crop, for reference only.
 * It is never used as the farmer's price: farmers usually get less.
 */
export default function BulletinPriceLine({ lang, cropKey, bulletin, className = '' }: Props) {
  const state = cropPriceFromBulletin(bulletin, cropKey);
  const bn = lang === 'bn';
  const n = (v: number) => formatNumber(v, lang);

  if (state.kind === 'unavailable') return null;

  if (state.kind === 'not_listed') {
    return (
      <p className={`text-sm text-stone-500 dark:text-stone-400 ${className}`}>
        {bn ? 'সরকারি তালিকায় এই ফসলের দাম নেই।' : 'This crop is not in the government list.'}
      </p>
    );
  }

  const { low, high } = state.price;
  const range = `৳${n(low)}–${n(high)}`;

  let text: string;
  if (state.kind === 'official') {
    const monRange = `৳${n(perKgToPerMon(low))}–${n(perKgToPerMon(high))}`;
    const date = bulletinDateLabel(state.fetchedAt, lang);
    text = bn
      ? `ঢাকার বাজারে আজ: ${range}/কেজি (${monRange}/মণ), সরকারি তালিকা${date ? `, ${date}` : ''}। কৃষক সাধারণত এর চেয়ে কম দাম পান।`
      : `Dhaka markets today: ${range}/kg (${monRange}/mon), government list${date ? `, ${date}` : ''}. Farmers usually get less than this.`;
  } else {
    text = bn
      ? `সরকারি তালিকায় ধান নেই; চালের দাম ${range}/কেজি।`
      : `The government list has no paddy price; rice is ${range}/kg.`;
  }

  return (
    <p className={`flex items-start gap-2 text-sm leading-relaxed text-stone-700 dark:text-stone-300 ${className}`}>
      <Landmark className="w-4 h-4 mt-0.5 shrink-0 text-stone-500 dark:text-stone-400" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
