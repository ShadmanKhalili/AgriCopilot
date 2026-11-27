import React, { useEffect, useState } from 'react';
import { Loader2, MapPin, Users } from 'lucide-react';
import type { Language } from '../../utils/translations';
import { fetchLocalPrice, type LocalPrice } from '../../services/areaReports';
import { bulletinDateLabel } from '../../utils/marketPriceView';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../AuthProvider';
import toBn from '../../utils/banglaNum';
import Card from '../ui/Card';
import ListenButton from '../ui/ListenButton';

interface Props {
  lang: Language;
  /** Crop slug used in area reports, such as `potato`. */
  crop: string;
  /** Crop name to show, in the screen's language. */
  cropName: string;
  /** Changes whenever a new report was sent, so the card reads the summary again. */
  refreshKey?: number;
}

type State = { kind: 'loading' } | { kind: 'ready'; price: LocalPrice | null };

/**
 * What farmers in the same upazila say they sold this crop for.
 *
 * Shown only when at least 3 different farmers reported (the server rule), and
 * always labelled as reported by farmers and not checked. It is never mixed
 * with the government price.
 */
export default function LocalPriceCard({ lang, crop, cropName, refreshKey = 0 }: Props) {
  const bn = lang === 'bn';
  const { place } = useAppSettings();
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const district = place?.district ?? null;
  const upazila = place?.upazila ?? null;
  const uid = user?.uid ?? null;
  const ready = Boolean(uid && district && upazila);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchLocalPrice(district, upazila, crop)
      .then((price) => {
        if (!cancelled) setState({ kind: 'ready', price });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'ready', price: null });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, district, upazila, uid, crop, refreshKey]);

  const num = (n: number) => (bn ? toBn(n.toLocaleString('en-IN')) : n.toLocaleString('en-IN'));
  const placeName = bn ? place?.upazilaBn || upazila : upazila;

  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
      <Users className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      <span>{bn ? `আপনার এলাকার কৃষকদের দাম: ${cropName}` : `What farmers near you got: ${cropName}`}</span>
    </h2>
  );

  const label = (
    <p className="mt-1 inline-block rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-1 text-sm font-bold text-amber-900 dark:text-amber-200">
      {bn ? 'কৃষকদের জানানো দাম, যাচাই করা নয়' : 'Reported by farmers, not checked'}
    </p>
  );

  // Signed out, or no upazila chosen: say what is needed instead of showing nothing.
  if (!ready) {
    const text = !uid
      ? bn
        ? 'আপনার এলাকার কৃষকদের বিক্রির দাম দেখতে অ্যাকাউন্টে ঢুকুন।'
        : 'Sign in to see the prices farmers near you sold at.'
      : bn
        ? 'আপনার উপজেলা ঠিক করা নেই। উপজেলা বেছে নিলে এলাকার কৃষকদের দাম এখানে দেখা যাবে।'
        : 'Your upazila is not set. Once you choose it, prices from farmers near you will show here.';
    return (
      <Card>
        {heading}
        <p className="mt-2 flex items-start gap-2 text-base text-stone-700 dark:text-stone-300 leading-snug">
          <MapPin className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{text}</span>
        </p>
      </Card>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Card>
        {heading}
        <p className="mt-2 flex items-center gap-2 text-base text-stone-600 dark:text-stone-300">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          {bn ? 'দাম আনা হচ্ছে…' : 'Loading prices…'}
        </p>
      </Card>
    );
  }

  const { price } = state;

  if (!price) {
    const text = bn
      ? 'আপনার কাছাকাছি এখনো যথেষ্ট কৃষক দাম জানাননি (অন্তত ৩ জন কৃষক লাগে)।'
      : 'Not enough reports yet near you (needs 3 farmers).';
    return (
      <Card>
        {heading}
        {label}
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300 leading-snug">{text}</p>
        <ListenButton text={text} lang={lang} className="mt-3" />
      </Card>
    );
  }

  const date = bulletinDateLabel(`${price.lastDay}T12:00:00+06:00`, lang);
  const headline = bn ? `মণে ৳${num(price.avgPerMon)}` : `৳${num(price.avgPerMon)} per mon`;
  const range = bn
    ? `কম ৳${num(price.lowPerMon)} – বেশি ৳${num(price.highPerMon)} (প্রতি মণ, ৪০ কেজি)`
    : `Low ৳${num(price.lowPerMon)} – high ৳${num(price.highPerMon)} per mon (40 kg)`;
  const who = bn
    ? `${num(price.farmers)} জন কৃষক${placeName ? `, ${placeName}` : ''}${date ? ` · শেষ জানানো ${date}` : ''}`
    : `${price.farmers} farmers${placeName ? `, ${placeName}` : ''}${date ? ` · last reported ${date}` : ''}`;
  const spoken = bn
    ? `আপনার এলাকার কৃষকরা ${cropName} বিক্রি করেছেন গড়ে মণে ${num(price.avgPerMon)} টাকায়। ${range}। ${who}। এটি কৃষকদের জানানো দাম, যাচাই করা নয়।`
    : `Farmers near you sold ${cropName} at about ${num(price.avgPerMon)} taka per mon. ${range}. ${who}. This is reported by farmers and not checked.`;

  return (
    <Card>
      {heading}
      {label}
      <p className="mt-2 text-sm font-semibold text-stone-600 dark:text-stone-300">
        {bn ? 'আপনার এলাকার কৃষকরা বিক্রি করেছেন গড়ে' : 'Farmers near you sold at about'}
      </p>
      <p className="text-3xl font-black text-stone-900 dark:text-white leading-tight">{headline}</p>
      <p className="mt-1 text-base text-stone-700 dark:text-stone-300">{range}</p>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{who}</p>
      <ListenButton text={spoken} lang={lang} className="mt-3" />
    </Card>
  );
}
