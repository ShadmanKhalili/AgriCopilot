import React, { useState } from 'react';
import { Sparkles, Info } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { SchemeMatch } from '../../utils/schemeMatch';
import { toBn } from '../../utils/banglaNum';
import SimpleSchemeCard from './SimpleSchemeCard';
import { matchLine, type FarmerLabels } from './matchWords';
import type { GovScheme } from './types';

interface Props {
  lang: Language;
  matches: SchemeMatch<GovScheme>[];
  labels: FarmerLabels;
  onAsk: (scheme: GovScheme) => void;
  /** How many cards to show before "Show more". */
  initialCount?: number;
}

const missingNote = (lang: Language, labels: FarmerLabels): string | null => {
  const bn = lang === 'bn';
  if (!labels.crop && !labels.district) {
    return bn
      ? 'আপনার ফসল ও জেলা এখনো বলা নেই। তাই সব কৃষকের প্রকল্প দেখানো হলো।'
      : 'Your crop and district are not set yet. So we show schemes for all farmers.';
  }
  if (!labels.crop) {
    return bn
      ? 'আপনার ফসল এখনো বলা নেই। কিছু প্রকল্প শুধু কিছু ফসলের জন্য।'
      : 'Your crop is not set yet. Some schemes are only for some crops.';
  }
  if (!labels.district) {
    return bn
      ? 'আপনার জেলা এখনো বলা নেই। কিছু প্রকল্প শুধু কিছু জেলায়।'
      : 'Your district is not set yet. Some schemes are only in some districts.';
  }
  return null;
};

/** The schemes matched to this farmer, strongest first. */
export default function ForYouSection({ lang, matches, labels, onAsk, initialCount = 5 }: Props) {
  const bn = lang === 'bn';
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? matches : matches.slice(0, initialCount);
  const hidden = matches.length - shown.length;
  const note = missingNote(lang, labels);

  return (
    <section aria-labelledby="schemes-for-you" className="space-y-3">
      <h3 id="schemes-for-you" className="flex items-center gap-2 text-xl font-bold text-stone-900 dark:text-stone-50">
        <Sparkles className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        {bn ? `আপনার জন্য (${toBn(matches.length)})` : `For you (${matches.length})`}
      </h3>

      {note && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 p-3 text-base text-amber-900 dark:text-amber-200">
          <Info className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}

      {matches.length === 0 ? (
        <p className="text-base text-stone-700 dark:text-stone-300">
          {bn ? 'এখনো আপনার সাথে মেলে এমন প্রকল্প নেই। নিচে সব প্রকল্প দেখুন।' : 'No scheme matches you yet. See all schemes below.'}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((m) => (
            <SimpleSchemeCard
              key={m.scheme.id}
              scheme={m.scheme}
              lang={lang}
              why={matchLine(m, lang, labels)}
              strong={m.level === 'strong'}
              onAsk={onAsk}
            />
          ))}
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full min-h-[48px] rounded-2xl border border-stone-300 dark:border-emerald-900/60 text-base font-bold text-stone-800 dark:text-stone-100"
        >
          {bn ? `আরও ${toBn(hidden)}টি দেখুন` : `Show ${hidden} more`}
        </button>
      )}
    </section>
  );
}
