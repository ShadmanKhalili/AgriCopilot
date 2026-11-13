import React from 'react';
import { ArrowDownRight, ArrowUpRight, Landmark, Minus, RefreshCw } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { OfficialBulletin } from '../../services/marketPrices';
import { bulletinDateLabel, cropPriceFromBulletin, perKgToPerMon } from '../../utils/marketPriceView';
import toBn from '../../utils/banglaNum';
import Card from '../ui/Card';
import ListenButton from '../ui/ListenButton';

interface Props {
  lang: Language;
  /** Crop key, such as `onion`. */
  crop: string;
  /** Crop name to show, in the screen's language. */
  cropName: string;
  bulletin: OfficialBulletin | null;
  status: 'loading' | 'ready' | 'failed';
  onRetry: () => void;
}

/**
 * Today's government price for one crop, and nothing invented.
 *
 * The figure is the Department of Agricultural Marketing's published range
 * for Dhaka markets. When the bulletin does not list the crop, the card says
 * so instead of showing a number.
 */
export default function OfficialPriceCard({ lang, crop, cropName, bulletin, status, onRetry }: Props) {
  const bn = lang === 'bn';
  const num = (n: number) => (bn ? toBn(n.toLocaleString('en-IN')) : n.toLocaleString('en-IN'));
  const state = cropPriceFromBulletin(bulletin, crop);

  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
      <Landmark className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      <span>{bn ? `আজকের সরকারি দাম: ${cropName}` : `Today's government price: ${cropName}`}</span>
    </h2>
  );

  if (status === 'loading' && !bulletin) {
    return (
      <Card>
        {heading}
        <p className="mt-2 text-base text-stone-600 dark:text-stone-300">{bn ? 'দাম আনা হচ্ছে…' : 'Loading prices…'}</p>
      </Card>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <Card>
        {heading}
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300">
          {bn ? 'আজকের সরকারি দাম পাওয়া যায়নি।' : "Today's government prices could not be loaded."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 min-h-[48px] px-4 rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 text-base font-bold text-stone-800 dark:text-stone-100"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          {bn ? 'আবার চেষ্টা করুন' : 'Try again'}
        </button>
      </Card>
    );
  }

  if (state.kind === 'not_listed') {
    const text = bn
      ? `সরকারের দৈনিক দামের তালিকায় ${cropName} নেই। আপনার কাছের বাজারে বা উপজেলা কৃষি অফিসে দাম জেনে নিন।`
      : `The government's daily price list does not include ${cropName.toLowerCase()}. Ask at your nearest market or the upazila agriculture office.`;
    return (
      <Card>
        {heading}
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300 leading-snug">{text}</p>
        <ListenButton text={text} lang={lang} className="mt-3" />
      </Card>
    );
  }

  const { price, fetchedAt, stale } = state;
  const related = state.kind === 'related';
  const date = bulletinDateLabel(fetchedAt, lang);
  const itemName = bn ? price.name : price.label;
  const moved = price.changePct !== null && price.changePct !== 0;
  const Arrow = !moved ? Minus : price.direction === 'up' ? ArrowUpRight : price.direction === 'down' ? ArrowDownRight : Minus;
  const change =
    price.changePct === null || price.changePct === 0
      ? bn ? 'গতকালের মতোই' : 'Same as yesterday'
      : price.direction === 'up'
        ? bn ? `গতকালের চেয়ে ${num(price.changePct)}% বেশি` : `${price.changePct}% higher than yesterday`
        : bn ? `গতকালের চেয়ে ${num(price.changePct)}% কম` : `${price.changePct}% lower than yesterday`;

  const range = bn
    ? `৳${num(price.low)} – ৳${num(price.high)} প্রতি কেজি`
    : `৳${num(price.low)} – ৳${num(price.high)} per kg`;
  const perMon = bn
    ? `মণে ৳${num(perKgToPerMon(price.low))} – ৳${num(perKgToPerMon(price.high))}`
    : `৳${num(perKgToPerMon(price.low))} – ৳${num(perKgToPerMon(price.high))} per mon`;

  const explain = related
    ? bn
      ? `সরকারি তালিকায় ধানের দাম নেই। এটি ${price.name}-এর দাম, ধানের নয়।`
      : `The government list has no paddy price. This is the price of ${price.label.toLowerCase()}, not paddy.`
    : bn
      ? 'এটি ঢাকার বাজারের দামের সীমা। কৃষক সাধারণত এর চেয়ে কম দাম পান।'
      : 'This is the price range in Dhaka markets. Farmers usually get less than this.';

  const spoken = bn
    ? `${itemName}: ${range}। ${change}। ${explain}`
    : `${itemName}: ${range}. ${change}. ${explain}`;

  return (
    <Card>
      {heading}
      {related && (
        <p className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-300">{itemName}</p>
      )}
      <p className="mt-2 text-3xl font-black text-stone-900 dark:text-white leading-tight">{range}</p>
      <p className="mt-1 text-base text-stone-600 dark:text-stone-300">{perMon}</p>
      <p className="mt-2 flex items-center gap-1.5 text-base font-bold text-stone-800 dark:text-stone-100">
        <Arrow className="w-5 h-5" aria-hidden="true" />
        {change}
      </p>
      <p className="mt-2 text-base text-stone-700 dark:text-stone-300 leading-snug">{explain}</p>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        {bn ? 'উৎস: কৃষি বিপণন অধিদপ্তর' : 'Source: Department of Agricultural Marketing'}
        {date ? ` · ${date}` : ''}
        {stale ? (bn ? ' (পুরোনো কপি)' : ' (older copy)') : ''}
      </p>
      <ListenButton text={spoken} lang={lang} className="mt-3" />
    </Card>
  );
}
