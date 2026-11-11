import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import { startListening } from '../../utils/speech';

interface Props {
  lang: Language;
  /** Called with what the farmer said. */
  onResult: (transcript: string) => void;
  className?: string;
}

/**
 * Voice input for one spoken phrase. Tapping it again while it is listening
 * stops it.
 */
export default function MicButton({ lang, onResult, className = '' }: Props) {
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const toggle = () => {
    if (listening) {
      stopRef.current?.();
      setListening(false);
      return;
    }
    const stop = startListening(lang, {
      onResult,
      onEnd: () => setListening(false),
      onError: (code) => {
        setListening(false);
        if (code === 'no-speech' || code === 'aborted') return;
        toast.error(
          code === 'not-allowed'
            ? lang === 'bn' ? 'মাইক্রোফোনের অনুমতি দিন।' : 'Please allow the microphone.'
            : lang === 'bn' ? 'কথা শোনা যায়নি। আবার চেষ্টা করুন।' : 'Could not hear you. Please try again.'
        );
      },
    });
    if (!stop) {
      toast.error(lang === 'bn' ? 'এই ফোনে কথা বলে লেখা যায় না। লিখে দিন।' : 'Voice input is not available here. Please type.');
      return;
    }
    stopRef.current = stop;
    setListening(true);
  };

  const label = listening
    ? lang === 'bn' ? 'থামান' : 'Stop'
    : lang === 'bn' ? 'বলে লিখুন' : 'Speak';
  const Icon = listening ? Square : Mic;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={listening}
      className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full active:scale-95 transition-transform ${listening ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-700 text-white'} ${className}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
