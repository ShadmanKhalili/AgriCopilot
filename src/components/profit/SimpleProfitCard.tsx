import React from 'react';
import { BookmarkPlus, Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { OfficialBulletin } from '../../services/marketPrices';
import { CROP_BENCHMARKS } from '../../data/cropBenchmarks';
import { LAND_UNITS, MAX_LAND_SIZE, MAX_PRICE_PER_MON, planResult, type LandUnit } from '../../utils/seasonMath';
import { formatNumber, formatTaka, LAND_UNIT_LABELS } from '../../utils/profitPlan';
import Card from '../ui/Card';
import ListenButton from '../ui/ListenButton';
import NumberField from './NumberField';
import VoiceAmountButton from './VoiceAmountButton';
import BulletinPriceLine from './BulletinPriceLine';

interface Props {
  lang: Language;
  cropKey: string;
  onCropChange: (cropKey: string) => void;
  landSize: number;
  landUnit: LandUnit;
  onLandChange: (size: number, unit: LandUnit) => void;
  pricePerMon: number;
  onPriceChange: (price: number) => void;
  /** Total cost the calculator shows (typical, or the farmer's own if edited). */
  totalCost: number;
  yieldMon: number;
  bulletin: OfficialBulletin | null;
  onSave: () => void;
  /** Set while a saved plan is being changed, so the button says so. */
  editing?: boolean;
}

/** Unit buttons in the order farmers use them most. */
const UNIT_ORDER: LandUnit[] = ['bigha', 'decimal', 'acre', 'katha'];

/**
 * The farmer's view of the calculator: crop, land, price, then cost,
 * income and profit or loss in three big lines.
 */
export default function SimpleProfitCard({
  lang, cropKey, onCropChange, landSize, landUnit, onLandChange,
  pricePerMon, onPriceChange, totalCost, yieldMon, bulletin, onSave, editing = false,
}: Props) {
  const bn = lang === 'bn';
  const { income, profit, breakEvenPerMon } = planResult(totalCost, yieldMon, pricePerMon);
  const isProfit = profit >= 0;
  const taka = (v: number) => formatTaka(v, lang);
  const crop = CROP_BENCHMARKS[cropKey];
  const cropName = crop ? (bn ? crop.shortBn : crop.shortEn) : cropKey;

  const spoken = [
    bn ? `${cropName}।` : `${cropName}.`,
    bn ? `খরচ ${taka(totalCost)}।` : `Cost ${taka(totalCost)}.`,
    bn ? `আয় ${taka(income)}।` : `Income ${taka(income)}.`,
    isProfit
      ? (bn ? `লাভ ${taka(profit)}।` : `Profit ${taka(profit)}.`)
      : (bn ? `ক্ষতি ${taka(profit)}।` : `Loss ${taka(profit)}.`),
    breakEvenPerMon !== null
      ? (bn ? `প্রতি মণ ${taka(breakEvenPerMon)} এর কমে বিক্রি করলে লোকসান।` : `Selling below ${taka(breakEvenPerMon)} per mon loses money.`)
      : '',
  ].join(' ');

  return (
    <Card className="space-y-6 p-5">
      <h2 className="text-2xl font-black text-stone-900 dark:text-stone-50">
        {bn ? 'লাভ-ক্ষতির হিসাব' : 'Profit or loss'}
      </h2>

      {/* a. Crop */}
      <fieldset>
        <legend className="text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
          {bn ? '১. কোন ফসল?' : '1. Which crop?'}
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(CROP_BENCHMARKS).map(([key, c]) => {
            const active = key === cropKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCropChange(key)}
                aria-pressed={active}
                className={`min-h-[56px] flex items-center gap-2 px-3 rounded-2xl border-2 text-left text-lg font-bold transition-colors active:scale-[0.98] ${
                  active
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100'
                    : 'border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100'
                }`}
              >
                <span className="text-2xl leading-none" aria-hidden="true">{c.emoji}</span>
                <span className="leading-tight">{bn ? c.shortBn : c.shortEn}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* b. Land */}
      <div className="space-y-2">
        <NumberField
          id="simple-land-size"
          lang={lang}
          label={bn ? '২. কতটুকু জমি?' : '2. How much land?'}
          value={landSize}
          onValue={(v) => {
            if (v !== null && v > 0 && v <= MAX_LAND_SIZE) onLandChange(v, landUnit);
          }}
        />
        <div role="radiogroup" aria-label={bn ? 'জমির একক' : 'Land unit'} className="grid grid-cols-4 gap-2">
          {UNIT_ORDER.filter((u) => LAND_UNITS.includes(u)).map((u) => {
            const active = u === landUnit;
            return (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onLandChange(landSize, u)}
                className={`min-h-[56px] rounded-2xl border-2 text-lg font-bold transition-colors ${
                  active
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-700'
                    : 'border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100'
                }`}
              >
                {LAND_UNIT_LABELS[u][bn ? 'bn' : 'en']}
              </button>
            );
          })}
        </div>
      </div>

      {/* c. Price */}
      <div className="space-y-2">
        <NumberField
          id="simple-price"
          lang={lang}
          label={bn ? '৩. প্রতি মণ কত দামে বিক্রি করবেন বলে মনে করেন?' : '3. What price per mon do you expect?'}
          value={pricePerMon}
          suffix={bn ? '৳ / মণ' : '৳ / mon'}
          onValue={(v) => {
            if (v !== null && v > 0 && v <= MAX_PRICE_PER_MON) onPriceChange(Math.round(v));
          }}
        >
          <VoiceAmountButton
            lang={lang}
            size="lg"
            label={bn ? 'প্রতি মণের দাম' : 'Price per mon'}
            onAmount={(v) => { if (v > 0 && v <= MAX_PRICE_PER_MON) onPriceChange(v); }}
          />
        </NumberField>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {bn
            ? `সাধারণ দাম ${taka(crop?.defaultPricePerMon ?? pricePerMon)} বসানো আছে। আপনি যে দাম পাবেন বলে মনে করেন তা দিন।`
            : `A typical price of ${taka(crop?.defaultPricePerMon ?? pricePerMon)} is filled in. Change it to the price you expect.`}
        </p>
        <BulletinPriceLine lang={lang} cropKey={cropKey} bulletin={bulletin} />
      </div>

      {/* Result */}
      <section
        aria-live="polite"
        aria-label={bn ? 'ফলাফল' : 'Result'}
        className="rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-700 p-4 space-y-3"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold text-stone-700 dark:text-stone-300">{bn ? 'খরচ' : 'Cost'}</span>
          <span className="text-2xl font-black tabular-nums text-stone-900 dark:text-stone-50">{taka(totalCost)}</span>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-stone-700 dark:text-stone-300">{bn ? 'আয়' : 'Income'}</span>
            <span className="text-2xl font-black tabular-nums text-stone-900 dark:text-stone-50">{taka(income)}</span>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 text-right">
            {bn
              ? `ফলন প্রায় ${formatNumber(yieldMon, lang)} মণ × ${taka(pricePerMon)}`
              : `About ${formatNumber(yieldMon, lang)} mon × ${taka(pricePerMon)}`}
          </p>
        </div>
        <div
          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 border-2 ${
            isProfit
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100'
              : 'border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-100'
          }`}
        >
          <span className="flex items-center gap-2 text-xl font-black">
            {isProfit
              ? <TrendingUp className="w-7 h-7" aria-hidden="true" />
              : <TrendingDown className="w-7 h-7" aria-hidden="true" />}
            {isProfit ? (bn ? 'লাভ' : 'Profit') : (bn ? 'ক্ষতি' : 'Loss')}
          </span>
          <span className="text-3xl font-black tabular-nums">{taka(profit)}</span>
        </div>
        {breakEvenPerMon !== null && (
          <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
            {bn
              ? `প্রতি মণ ${taka(breakEvenPerMon)} এর কমে বিক্রি করলে লোকসান`
              : `Selling below ${taka(breakEvenPerMon)} per mon loses money`}
          </p>
        )}
        <ListenButton text={spoken} lang={lang} className="min-h-[48px]" />
      </section>

      <p className="flex items-start gap-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {bn
            ? "খরচ ও ফলন সাধারণ হিসাব, আপনার নিজের হিসাব দিতে নিচে 'আরও বিস্তারিত' খুলুন।"
            : "Costs and yield are typical figures. Open 'More details' to enter your own."}
        </span>
      </p>

      <button
        type="button"
        onClick={onSave}
        className="w-full min-h-[56px] flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-bold active:scale-[0.98] transition-transform dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        <BookmarkPlus className="w-6 h-6" aria-hidden="true" />
        {editing ? (bn ? 'বদল রাখুন' : 'Save changes') : (bn ? 'হিসাব রাখুন' : 'Save this plan')}
      </button>
    </Card>
  );
}
