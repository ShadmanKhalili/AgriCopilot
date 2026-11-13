import React, { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import { toBn } from '../../utils/banglaNum';

/**
 * Parse a spoken amount into a number. Accepts plain digits / Bangla digits and
 * common spoken Bangla forms (word-digits 0-99 combined with hajar/likkho/koti
 * multipliers). Returns null when nothing amount-like was heard.
 */
export const parseSpokenAmount = (raw: string): number | null => {
  const t = String(raw || '').replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const WORDS: Record<string, number> = {
    'শূন্য': 0, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4,
    'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9,
    'দশ': 10, 'এগারো': 11, 'বারো': 12, 'তেরো': 13, 'চৌদ্দ': 14,
    'পনেরো': 15, 'ষোলো': 16, 'সতেরো': 17, 'আঠারো': 18, 'ঊনিশ': 19,
    'বিশ': 20, 'ত্রিশ': 30, 'চল্লিশ': 40, 'পঞ্চাশ': 50,
    'ষাট': 60, 'সত্তর': 70, 'আশি': 80, 'নব্বই': 90,
    'একশ': 100, 'একশো': 100, 'শ': 100, 'শত': 100,
  };
  const MULT: Record<string, number> = {
    'কোটি': 10000000, 'লক্ষ': 100000, 'হাজার': 1000,
  };
  const tokens = t.split(/[\s,]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let found = false;
  for (const tok of tokens) {
    const w = tok.replace(/[।.,]/g, '');
    if (/^\d+(?:\.\d+)?$/.test(w)) { current += parseFloat(w); found = true; continue; }
    // hundreds compounds like "panch sho" (500)
    if (w.endsWith('শ') || w.endsWith('শো')) {
      const base = w.replace(/(?:শো|শ)$/, '');
      if (base && base in WORDS) { current += WORDS[base] * 100; found = true; continue; }
    }
    if (w in WORDS) { current += WORDS[w]; found = true; continue; }
    if (w in MULT) { total += (current === 0 ? 1 : current) * MULT[w]; current = 0; found = true; continue; }
  }
  return found ? Math.round(total + current) : null;
};

interface Props {
  lang: Language;
  label: string;
  onAmount: (amount: number) => void;
  /** `lg` is the 56px button for the simple screens. */
  size?: 'md' | 'lg';
}

/** Voice-first money input: tap the mic, say the amount, the field updates. */
export default function VoiceAmountButton({ lang, label, onAmount, size = 'md' }: Props) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => () => {
    try { recRef.current?.abort?.(); } catch { /* already stopped */ }
  }, []);

  const startListening = () => {
    if (listening) {
      try { recRef.current?.stop(); } catch { /* already stopped */ }
      setListening(false);
      return;
    }
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) {
      toast.error(lang === 'bn' ? 'এই ফোনে মুখে বলে লেখা যাচ্ছে না। সংখ্যাটি লিখে দিন।' : 'Voice input is not supported here. Please type the number.');
      return;
    }
    try {
      const rec = new SRClass();
      recRef.current = rec;
      rec.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setListening(true);
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        const amount = parseSpokenAmount(transcript);
        if (amount !== null) {
          const clean = Math.max(0, Math.round(amount));
          onAmount(clean);
          const shown = '৳' + (lang === 'bn' ? toBn(clean.toLocaleString('en-IN')) : clean.toLocaleString('en-IN'));
          toast.success(lang === 'bn' ? shown + ' বসানো হয়েছে' : shown + ' set');
        } else {
          toast.error(lang === 'bn' ? 'টাকার পরিমাণ বোঝা যায়নি; আবার বলুন' : 'Amount not understood - try saying it again');
        }
      };
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const dims = size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-12 h-12 rounded-xl';

  return (
    <button
      type="button"
      onClick={startListening}
      aria-pressed={listening}
      aria-label={lang === 'bn' ? `${label}: মুখে বলুন` : `${label}: speak the amount`}
      title={lang === 'bn' ? 'মাইক চেপে টাকার পরিমাণ বলুন' : 'Speak the amount'}
      className={`${dims} flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${
        listening
          ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 animate-pulse'
          : 'bg-stone-50 dark:bg-stone-800/80 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-emerald-700 hover:border-emerald-300'
      }`}
    >
      <Mic className={size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} aria-hidden="true" />
    </button>
  );
}
