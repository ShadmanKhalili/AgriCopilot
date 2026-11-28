import React, { useState } from 'react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import {
  BUYER_LABELS,
  BUYER_TYPES,
  MAX_PRICE_PER_MON,
  MAX_QUANTITY_MON,
  type BuyerType,
  type SaleInput,
} from '../../../netlify/functions/_shared/farm-record-model';
import { dhakaDateString } from '../../utils/farmTaskDates';
import NumberField from '../profit/NumberField';
import VoiceAmountButton from '../profit/VoiceAmountButton';
import Chip, { FIELD_CLASS, LABEL_CLASS } from './Chip';

interface Props {
  lang: Language;
  /** Save the sale. Returns false when it is not valid (the parent has said why). */
  onSave: (input: SaleInput) => boolean;
  onCancel: () => void;
}

/** "I sold some of this crop": how much, at what price, to whom, and when. */
export default function SaleForm({ lang, onSave, onCancel }: Props) {
  const bn = lang === 'bn';
  const today = dhakaDateString();
  const [qty, setQty] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [buyer, setBuyer] = useState<BuyerType | null>(null);
  const [date, setDate] = useState(today);

  const ready =
    qty !== null && qty > 0 && qty <= MAX_QUANTITY_MON &&
    price !== null && Math.round(price) >= 1 && price <= MAX_PRICE_PER_MON &&
    buyer !== null && date !== '' && date <= today;

  const submit = () => {
    if (!ready || qty === null || price === null || buyer === null) {
      toast.error(
        bn
          ? 'কত মণ, প্রতি মণ কত টাকা, কার কাছে আর কবে - সব দিন।'
          : 'Enter how many mon, the price per mon, who bought it, and the date.'
      );
      return;
    }
    onSave({ quantityMon: qty, pricePerMon: Math.round(price), buyerType: buyer, date });
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-4">
      <p className="text-lg font-black text-stone-900 dark:text-stone-50">{bn ? 'বিক্রি লিখুন' : 'Record a sale'}</p>

      <NumberField
        id="sale-qty"
        label={bn ? 'কত মণ বিক্রি করলেন?' : 'How many mon did you sell?'}
        lang={lang}
        value={qty}
        onValue={setQty}
        suffix={bn ? 'মণ' : 'mon'}
      />

      <NumberField
        id="sale-price"
        label={bn ? 'প্রতি মণ কত টাকা পেলেন?' : 'Price you got per mon'}
        lang={lang}
        value={price}
        onValue={setPrice}
        suffix={bn ? '৳ / মণ' : '৳ / mon'}
      >
        <VoiceAmountButton
          lang={lang}
          size="lg"
          label={bn ? 'প্রতি মণ দাম' : 'Price per mon'}
          onAmount={setPrice}
        />
      </NumberField>

      <div>
        <p className={LABEL_CLASS}>{bn ? 'কার কাছে বিক্রি করলেন?' : 'Who did you sell to?'}</p>
        <div className="flex flex-wrap gap-2" role="group">
          {BUYER_TYPES.map((b) => (
            <Chip key={b} selected={buyer === b} onClick={() => setBuyer(b)}>
              {BUYER_LABELS[b][lang]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="sale-date" className={LABEL_CLASS}>{bn ? 'কবে বিক্রি করলেন?' : 'Date of sale'}</label>
        <input
          id="sale-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-stone-600 text-base font-bold text-stone-800 dark:text-stone-100 active:scale-[0.98]"
        >
          {bn ? 'থাক' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={submit}
          className="min-h-[56px] rounded-2xl bg-emerald-700 text-white text-base font-bold active:scale-[0.98]"
        >
          {bn ? 'বিক্রি রাখুন' : 'Save sale'}
        </button>
      </div>
    </div>
  );
}
