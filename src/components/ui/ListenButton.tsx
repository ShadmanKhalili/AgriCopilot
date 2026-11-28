import React, { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import { speakChecked, stopSpeaking } from '../../utils/speech';

interface Props {
  /** The text to read aloud. Markdown marks are stripped before speaking. */
  text: string;
  lang: Language;
  /** `icon` shows only the speaker; `full` adds the word "Listen". */
  variant?: 'icon' | 'full';
  className?: string;
}

/**
 * Reads a piece of text aloud with the device's own voice. Tapping it again
 * while it is speaking stops it.
 */
export default function ListenButton({ text, lang, variant = 'full', className = '' }: Props) {
  const [speaking, setSpeaking] = useState(false);
  // A tap that is still waiting for the phone's voice list.
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  // Stop when the button leaves the screen, so speech never outlives its card.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopSpeaking();
    };
  }, []);

  const toggle = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    let result: Awaited<ReturnType<typeof speakChecked>>;
    try {
      result = await speakChecked(text, lang, {
        onEnd: () => {
          if (mountedRef.current) setSpeaking(false);
        },
      });
    } finally {
      pendingRef.current = false;
    }
    if (!mountedRef.current) {
      // The card closed while the voices were loading.
      if (result === 'started') stopSpeaking();
      return;
    }
    if (result === 'started') {
      setSpeaking(true);
    } else if (result === 'no-voice') {
      toast.error(
        lang === 'bn'
          ? 'এই ফোনে বাংলা কণ্ঠ নেই। ফোনের সেটিংসে Text-to-speech-এ গিয়ে বাংলা ভাষা যোগ করুন।'
          : 'This phone has no Bangla voice. In your phone settings, open Text-to-speech and add Bangla.',
        { id: 'no-bangla-voice', duration: 7000 },
      );
    } else {
      toast.error(lang === 'bn' ? 'এই ফোনে পড়ে শোনানো যাচ্ছে না।' : 'This device cannot read aloud.');
    }
  };

  const label = speaking
    ? lang === 'bn' ? 'থামান' : 'Stop'
    : lang === 'bn' ? 'শুনুন' : 'Listen';
  const Icon = speaking ? Square : Volume2;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={speaking}
      className={`inline-flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] rounded-full border border-emerald-700 text-emerald-800 dark:text-emerald-300 dark:border-emerald-500 font-bold text-sm active:scale-95 transition-transform ${variant === 'full' ? 'px-4' : ''} ${className}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      {variant === 'full' && <span>{label}</span>}
    </button>
  );
}
