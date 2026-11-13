import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../../utils/translations';
import { toBn } from '../../utils/banglaNum';
import { parseNumberInput } from '../../utils/profitPlan';

interface Props {
  id: string;
  label: string;
  lang: Language;
  /** The current number; null shows an empty box. */
  value: number | null;
  /** Called with each valid number typed, or null when the box is empty or not a number. */
  onValue: (value: number | null) => void;
  /** Words after the box, such as "৳ / মণ". */
  suffix?: string;
  /** Extra controls next to the box (a mic button). */
  children?: React.ReactNode;
  className?: string;
}

const show = (value: number | null, lang: Language): string =>
  value === null || !Number.isFinite(value) ? '' : lang === 'bn' ? toBn(String(value)) : String(value);

/**
 * A large number box for the simple screens. It accepts Bangla or Latin
 * digits and keeps what the farmer is typing until they leave the box.
 */
export default function NumberField({ id, label, lang, value, onValue, suffix, children, className = '' }: Props) {
  const [text, setText] = useState(show(value, lang));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(show(value, lang));
  }, [value, lang]);

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onFocus={() => { editing.current = true; }}
            onBlur={() => { editing.current = false; setText(show(value, lang)); }}
            onChange={(e) => {
              setText(e.target.value);
              onValue(parseNumberInput(e.target.value));
            }}
            className={`w-full min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-4 text-lg font-bold text-stone-900 dark:text-stone-50 tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${suffix ? 'pr-24' : ''}`}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base font-semibold text-stone-500 dark:text-stone-400">
              {suffix}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
