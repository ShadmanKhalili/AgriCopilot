import React from 'react';

type Tone = 'green' | 'sky' | 'amber' | 'rose';

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-700 text-white',
  sky: 'bg-sky-700 text-white',
  amber: 'bg-amber-600 text-white',
  rose: 'bg-rose-700 text-white',
};

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  /** The main words: what tapping this does. */
  label: string;
  /** One short helper line under the label. */
  hint?: string;
  tone?: Tone;
  onClick: () => void;
  /** A small count shown on the corner, such as unread replies. */
  badge?: string;
  className?: string;
}

/**
 * A large picture button for the simple screens: one icon, a few words, and a
 * touch target far bigger than the 44px minimum.
 */
export default function BigActionButton({ icon: Icon, label, hint, tone = 'green', onClick, badge, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-2 min-h-[120px] w-full rounded-3xl p-4 text-center shadow-sm active:scale-[0.97] transition-transform ${TONES[tone]} ${className}`}
    >
      <Icon className="w-10 h-10" aria-hidden="true" />
      <span className="text-lg font-bold leading-snug">{label}</span>
      {hint && <span className="text-sm opacity-90 leading-snug">{hint}</span>}
      {badge && (
        <span className="absolute top-3 right-3 min-w-[24px] h-6 px-1.5 rounded-full bg-white text-emerald-800 text-sm font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
