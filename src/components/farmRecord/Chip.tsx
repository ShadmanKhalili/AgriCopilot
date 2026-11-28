import React from 'react';

interface Props {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

/** A big tap-to-choose button used for one-of-few answers (stage, tenure, unit, buyer). */
export default function Chip({ selected, onClick, children, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[52px] px-4 rounded-2xl border-2 text-base font-bold leading-snug active:scale-[0.97] transition-transform ${
        selected
          ? 'border-emerald-700 bg-emerald-700 text-white'
          : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** The class string for a text / date / select box that matches NumberField. */
export const FIELD_CLASS =
  'w-full min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-4 text-lg font-bold text-stone-900 dark:text-stone-50 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40';

export const LABEL_CLASS = 'block text-base font-bold text-stone-800 dark:text-stone-100 mb-2';
