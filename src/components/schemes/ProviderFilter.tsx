import React from 'react';
import type { Language } from '../../utils/translations';
import type { ProviderFilter as Filter } from '../../utils/schemeMatch';
import { toBn } from '../../utils/banglaNum';
import { providerLabel } from './matchWords';

const FILTERS: Filter[] = ['all', 'government', 'ngo', 'private'];

interface Props {
  lang: Language;
  value: Filter;
  onChange: (next: Filter) => void;
  /** How many items each choice would show. */
  counts: Record<Filter, number>;
}

/** Who runs the scheme: government, NGO or a private company. */
export default function ProviderFilter({ lang, value, onChange, counts }: Props) {
  const bn = lang === 'bn';
  return (
    <div role="group" aria-label={bn ? 'কারা দিচ্ছে' : 'Who offers it'} className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = value === f;
        const count = bn ? toBn(counts[f]) : String(counts[f]);
        return (
          <button
            key={f}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f)}
            className={`min-h-[48px] px-4 rounded-2xl border text-base font-bold active:scale-[0.97] transition-transform ${
              active
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white dark:bg-[#0c1c13] border-stone-300 dark:border-emerald-900/60 text-stone-800 dark:text-stone-100'
            }`}
          >
            {providerLabel(f, lang)} ({count})
          </button>
        );
      })}
    </div>
  );
}
