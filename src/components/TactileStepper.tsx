import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

interface TactileStepperProps {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md';
  precision?: number;
  lang?: 'en' | 'bn';
  label?: string;
}

export const TactileStepper: React.FC<TactileStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  unit,
  className = '',
  size = 'md',
  precision,
  lang = 'bn',
  label,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [rawText, setRawText] = useState(String(value));

  useEffect(() => {
    if (!isEditing) {
      setRawText(String(value));
    }
  }, [value, isEditing]);

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    const next = Math.max(min, Number((value - step).toFixed(precision ?? (step < 1 ? 2 : 0))));
    onChange(next);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    const next = Math.min(max, Number((value + step).toFixed(precision ?? (step < 1 ? 2 : 0))));
    onChange(next);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(rawText);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
      setRawText(String(clamped));
    } else {
      setRawText(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const btnPad = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9 sm:w-10 sm:h-10';
  const textPad = size === 'sm' ? 'py-1 px-2 text-xs' : 'py-1.5 px-3 text-sm';

  return (
    <div
      className={`inline-flex items-center rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 shadow-xs select-none transition-colors focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/20 ${className}`}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        aria-label={lang === 'bn' ? `${label ? label + ' ' : ''}মান কমান` : `Decrease ${label || 'value'}`}
        title={lang === 'bn' ? 'কমান' : 'Decrease'}
        className={`${btnPad} flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-200/80 dark:hover:bg-stone-700 rounded-l-xl transition-colors disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer shrink-0`}
      >
        <Minus className="w-4 h-4 stroke-[2.5]" />
      </button>

      <div className={`relative flex items-center justify-center min-w-[76px] sm:min-w-[96px] text-center border-x border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-900 ${textPad}`}>
        {isEditing ? (
          <input
            type="number"
            value={rawText}
            autoFocus
            min={min}
            max={max}
            step={step}
            aria-label={lang === 'bn' ? `${label || 'মান'} লিখুন` : `Input ${label || 'value'}`}
            onChange={(e) => setRawText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full text-center font-mono font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 bg-transparent outline-none p-0 m-0 tabular-nums"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title={lang === 'bn' ? 'সরাসরি সংখ্যা টাইপ করতে ক্লিক করুন' : 'Click to edit number manually'}
            aria-label={lang === 'bn' ? `${label ? label + ': ' : ''}${value} ${unit || ''} (সম্পাদনা করতে ক্লিক করুন)` : `${label ? label + ': ' : ''}${value} ${unit || ''} (click to edit)`}
            className="w-full flex items-baseline justify-center gap-1 font-mono font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 tabular-nums cursor-text hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>
            {unit && (
              <span className="text-xs font-sans font-medium text-stone-500 dark:text-stone-400 select-none">
                {unit}
              </span>
            )}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        aria-label={lang === 'bn' ? `${label ? label + ' ' : ''}মান বাড়ান` : `Increase ${label || 'value'}`}
        title={lang === 'bn' ? 'বাড়ান' : 'Increase'}
        className={`${btnPad} flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-200/80 dark:hover:bg-stone-700 rounded-r-xl transition-colors disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer shrink-0`}
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
};

export default TactileStepper;
