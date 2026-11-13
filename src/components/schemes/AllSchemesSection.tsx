import React from 'react';
import { Landmark } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { ProviderFilter as Filter } from '../../utils/schemeMatch';
import { toBn } from '../../utils/banglaNum';
import Disclosure from '../ui/Disclosure';
import ProviderFilter from './ProviderFilter';
import SimpleSchemeCard from './SimpleSchemeCard';
import { providerEmpty } from './matchWords';
import type { GovScheme } from './types';

interface Props {
  lang: Language;
  /** The schemes after the provider and topic filters. */
  schemes: GovScheme[];
  provider: Filter;
  onProviderChange: (next: Filter) => void;
  providerCounts: Record<Filter, number>;
  topics: string[];
  topic: string;
  onTopicChange: (next: string) => void;
  onAsk: (scheme: GovScheme) => void;
}

/** Every scheme, for the simple view, with the filters one tap away. */
export default function AllSchemesSection({
  lang, schemes, provider, onProviderChange, providerCounts, topics, topic, onTopicChange, onAsk,
}: Props) {
  const bn = lang === 'bn';

  return (
    <section aria-labelledby="schemes-all" className="space-y-3">
      <h3 id="schemes-all" className="flex items-center gap-2 text-xl font-bold text-stone-900 dark:text-stone-50">
        <Landmark className="w-6 h-6 text-sky-700 dark:text-sky-400" aria-hidden="true" />
        {bn ? `সব প্রকল্প (${toBn(schemes.length)})` : `All schemes (${schemes.length})`}
      </h3>

      <ProviderFilter lang={lang} value={provider} onChange={onProviderChange} counts={providerCounts} />

      {topics.length > 1 && (
        <Disclosure label={bn ? 'বিষয় দিয়ে খুঁজুন' : 'Filter by topic'} defaultOpen={topic !== 'All'}>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={topic === t}
                onClick={() => onTopicChange(t)}
                className={`min-h-[48px] px-4 rounded-2xl border text-base font-bold ${
                  topic === t
                    ? 'bg-sky-700 border-sky-700 text-white'
                    : 'bg-white dark:bg-[#0c1c13] border-stone-300 dark:border-emerald-900/60 text-stone-800 dark:text-stone-100'
                }`}
              >
                {t === 'All' ? (bn ? 'সব বিষয়' : 'All topics') : t}
              </button>
            ))}
          </div>
        </Disclosure>
      )}

      {schemes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 dark:border-emerald-900/60 p-4 text-base text-stone-700 dark:text-stone-300">
          {topic !== 'All'
            ? bn ? 'এই বিষয়ে কোনো প্রকল্প নেই।' : 'No schemes on this topic.'
            : providerEmpty(provider, lang)}
        </p>
      ) : (
        <div className="space-y-3">
          {schemes.map((scheme) => (
            <SimpleSchemeCard key={scheme.id} scheme={scheme} lang={lang} onAsk={onAsk} />
          ))}
        </div>
      )}
    </section>
  );
}
