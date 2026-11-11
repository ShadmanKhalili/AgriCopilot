import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  /** The words on the row that opens the section, such as "More options". */
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /**
   * Keep the content mounted while closed. Use it when the content holds
   * state (a form, a running session) that must survive being hidden.
   */
  keepMounted?: boolean;
  className?: string;
}

/**
 * A closed-by-default section. It is how detail a first-time farmer does not
 * need stays one tap away without being removed.
 */
export default function Disclosure({ label, children, defaultOpen = false, keepMounted = false, className = '' }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center justify-between gap-3 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-emerald-900/60 text-stone-800 dark:text-stone-100 font-bold text-sm active:scale-[0.99] transition-transform"
      >
        <span>{label}</span>
        <ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {(open || keepMounted) && (
        <div id={panelId} hidden={!open} className="pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
