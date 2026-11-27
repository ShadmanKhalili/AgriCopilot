import React, { useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import type { Language } from '../../utils/translations';
import { sendAreaReport } from '../../services/areaReports';
import { cleanPricePerMon } from '../../../netlify/functions/_shared/area-model';
import { toPricePerMon, type PriceUnit } from '../../utils/localPriceCrops';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../AuthProvider';
import toBn from '../../utils/banglaNum';
import Card from '../ui/Card';
import NumberField from '../profit/NumberField';
import VoiceAmountButton from '../profit/VoiceAmountButton';

interface Props {
  lang: Language;
  /** Crop slug used in area reports, such as `potato`. */
  crop: string;
  /** Crop name to show, in the screen's language. */
  cropName: string;
  /** Called after a report was sent, so the local price can be read again. */
  onSent?: () => void;
}

type Problem = 'not_configured' | 'signed_out' | 'failed' | 'invalid';
type Status = 'idle' | 'sending' | 'thanks' | Problem;

/** "What price did you get today?" One tap or one spoken number sends it. */
export default function ReportPriceForm({ lang, crop, cropName, onSent }: Props) {
  const bn = lang === 'bn';
  const { place } = useAppSettings();
  const { user } = useAuth();
  const [value, setValue] = useState<number | null>(null);
  const [unit, setUnit] = useState<PriceUnit>('mon');
  const [status, setStatus] = useState<Status>('idle');

  const district = place?.district ?? null;
  const upazila = place?.upazila ?? null;
  const num = (n: number) => (bn ? toBn(n.toLocaleString('en-IN')) : n.toLocaleString('en-IN'));

  const heading = (
    <h2 className="text-lg font-bold text-stone-900 dark:text-white">
      {bn ? 'আজ আপনি কী দাম পেয়েছেন?' : 'What price did you get today?'}
    </h2>
  );

  if (!user || !district || !upazila) {
    const text = !user
      ? bn
        ? 'দাম জানাতে অ্যাকাউন্টে ঢুকুন। আপনার নাম কেউ দেখবে না।'
        : 'Sign in to tell us your price. Nobody sees your name.'
      : bn
        ? 'দাম জানাতে আগে আপনার উপজেলা ঠিক করুন।'
        : 'Set your upazila first to share your price.';
    return (
      <Card>
        {heading}
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300 leading-snug">{text}</p>
      </Card>
    );
  }

  const perMon = toPricePerMon(value, unit);
  const clean = perMon === null ? null : cleanPricePerMon(perMon);
  const sending = status === 'sending';

  const submit = async () => {
    if (clean === null) {
      setStatus('invalid');
      return;
    }
    setStatus('sending');
    const result = await sendAreaReport({ kind: 'price', district, upazila, crop, pricePerMon: clean });
    if (result.ok === true) {
      setStatus('thanks');
      setValue(null);
      onSent?.();
    } else {
      // The project's TypeScript setup does not narrow on `ok: false`.
      setStatus((result as { reason: Problem }).reason);
    }
  };

  if (status === 'thanks') {
    return (
      <Card>
        <p className="flex items-start gap-2 text-lg font-bold text-emerald-800 dark:text-emerald-300 leading-snug">
          <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{bn ? 'ধন্যবাদ — এতে আপনার কাছাকাছি কৃষকদের উপকার হবে।' : 'Thank you — this helps farmers near you.'}</span>
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-3 min-h-[48px] px-4 rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 text-base font-bold text-stone-800 dark:text-stone-100"
        >
          {bn ? 'আরেকটি দাম জানান' : 'Report another price'}
        </button>
      </Card>
    );
  }

  const message: Record<Problem, string> = {
    not_configured: bn ? 'এই সুবিধা এখনো চালু হয়নি। কিছুদিন পরে চেষ্টা করুন।' : 'This is not set up yet. Please try again later.',
    signed_out: bn ? 'দাম জানাতে অ্যাকাউন্টে ঢুকুন।' : 'Please sign in to send your price.',
    failed: bn ? 'পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : 'It could not be sent. Check your internet and try again.',
    invalid: bn
      ? 'দামটি ঠিক মনে হচ্ছে না। সংখ্যাটি দেখে আবার লিখুন।'
      : 'That price does not look right. Please check the number.',
  };

  const clearProblem = () => {
    if (status !== 'idle' && status !== 'sending') setStatus('idle');
  };

  const unitButton = (key: PriceUnit, text: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={unit === key}
      onClick={() => {
        setUnit(key);
        clearProblem();
      }}
      className={`flex-1 min-h-[48px] rounded-2xl border-2 px-3 text-base font-bold transition-colors ${
        unit === key
          ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500'
          : 'border-stone-200 bg-white text-stone-800 dark:bg-[#0c1c13] dark:text-stone-100 dark:border-emerald-900/60'
      }`}
    >
      {text}
    </button>
  );

  const fieldLabel = bn ? `${cropName}: দাম (৳)` : `${cropName}: price (৳)`;

  return (
    <Card>
      {heading}
      <p className="mt-1 text-base text-stone-600 dark:text-stone-300">
        {bn ? `ফসল: ${cropName}। আপনার নাম কেউ দেখবে না।` : `Crop: ${cropName}. Nobody sees your name.`}
      </p>

      <div className="mt-3 flex gap-2" role="radiogroup" aria-label={bn ? 'দামের হিসাব' : 'Price unit'}>
        {unitButton('mon', bn ? 'প্রতি মণ' : 'Per mon')}
        {unitButton('kg', bn ? 'প্রতি কেজি' : 'Per kg')}
      </div>

      <NumberField
        id={`report-price-${crop}`}
        className="mt-3"
        label={fieldLabel}
        lang={lang}
        value={value}
        onValue={(next) => {
          setValue(next);
          clearProblem();
        }}
        suffix={unit === 'mon' ? (bn ? '৳ / মণ' : '৳ / mon') : bn ? '৳ / কেজি' : '৳ / kg'}
      >
        <VoiceAmountButton
          lang={lang}
          label={fieldLabel}
          size="lg"
          onAmount={(amount) => {
            setValue(amount);
            clearProblem();
          }}
        />
      </NumberField>

      {unit === 'kg' && perMon !== null && (
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300">
          {bn ? `মণে হিসাব: ৳${num(perMon)} (১ মণ = ৪০ কেজি)` : `Per mon: ৳${num(perMon)} (1 mon = 40 kg)`}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={sending || value === null}
        className="mt-4 w-full min-h-[56px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition-transform"
      >
        {sending ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Send className="w-5 h-5" aria-hidden="true" />}
        <span>{sending ? (bn ? 'পাঠানো হচ্ছে…' : 'Sending…') : bn ? 'দাম জানান' : 'Send my price'}</span>
      </button>

      {status !== 'idle' && status !== 'sending' && (
        <p role="alert" className="mt-3 text-base font-semibold text-rose-800 dark:text-rose-300 leading-snug">
          {message[status]}
        </p>
      )}
    </Card>
  );
}
