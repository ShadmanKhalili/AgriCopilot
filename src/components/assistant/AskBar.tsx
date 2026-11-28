import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, Mic, Send } from 'lucide-react';
import { canListen, startListening, stopSpeaking } from '../../utils/speech';
import { QUESTION_MAX, cleanQuestion } from './assistantView';

interface AskBarProps {
  lang: 'bn' | 'en';
  /** A question is ready: typed (`text`) or spoken (`voice`). */
  onAsk: (text: string, channel: 'text' | 'voice') => void;
  /** True while an answer is on its way: the mic and the send button wait. */
  disabled?: boolean;
  /** The small version for Home: a wide mic button above the text box. */
  compact?: boolean;
  placeholder?: string;
}

type Phase = 'idle' | 'listening' | 'finishing';

/** A press this long is "hold to talk": letting go ends the question. A shorter press is a tap, which keeps listening. */
const HOLD_MS = 450;
/** A click this soon after a pointer release belongs to that press, which was already handled. */
const CLICK_AFTER_POINTER_MS = 600;
/** If the browser never says that listening ended, stop waiting after this. */
const FINISH_TIMEOUT_MS = 4000;

/** What to tell the farmer when the microphone did not work. Null: nothing to say. */
const micErrorText = (code: string, bn: boolean): string | null => {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return bn ? 'মাইক্রোফোনের অনুমতি দিন।' : 'Please allow the microphone.';
    case 'no-speech':
      return bn ? 'কিছু শোনা যায়নি। আবার বলুন।' : 'I did not hear anything. Please speak again.';
    case 'audio-capture':
      return bn ? 'মাইক্রোফোন পাওয়া যায়নি। লিখে জিজ্ঞাসা করুন।' : 'No microphone found. Please type your question.';
    case 'network':
      return bn ? 'ইন্টারনেট না থাকায় কথা বোঝা যায়নি। লিখে জিজ্ঞাসা করুন।' : 'No internet, so I could not understand. Please type your question.';
    default:
      return bn ? 'কথা শোনা যায়নি। আবার চেষ্টা করুন বা লিখে জিজ্ঞাসা করুন।' : 'I could not hear you. Please try again or type.';
  }
};

/**
 * The place a question starts: a big mic button and a text box.
 *
 * The mic works two ways. Hold it, speak, and let go. Or tap it once, speak, and
 * it stops by itself when you pause (or tap again to stop). A spoken question is
 * sent as soon as the phone has understood it. Where the browser has no voice
 * input the mic is hidden and only the text box is shown.
 *
 * While listening, the words heard so far are shown under the mic (the browser's
 * interim results, see utils/speech.ts) so the farmer can see they are understood.
 * The finished sentence is sent as the farmer's message.
 */
export function AskBar({ lang, onAsk, disabled = false, compact = false, placeholder }: AskBarProps) {
  const bn = lang === 'bn';
  const inputId = useId();
  const [text, setText] = useState('');
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [hint, setHint] = useState<string | null>(null);
  /** The words heard so far, while listening. */
  const [interim, setInterim] = useState('');
  const [micAvailable] = useState<boolean>(() => canListen());

  const phaseRef = useRef<Phase>('idle');
  const stopRef = useRef<(() => void) | null>(null);
  /** Counts listening sessions; the events of an older one are ignored. */
  const sessionRef = useRef(0);
  const pressRef = useRef<{ startedAt: number; startedHere: boolean } | null>(null);
  const lastPointerUpRef = useRef(0);
  /** The last start was refused, which on some phones (iPhone) means it did not come from a tap the browser accepts. */
  const gestureRetryRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const disabledRef = useRef(disabled);
  const onAskRef = useRef(onAsk);

  useEffect(() => {
    onAskRef.current = onAsk;
    disabledRef.current = disabled;
  });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearFinishTimer = () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  /** Stop listening and drop whatever it was about to deliver. */
  const cancelListening = useCallback(() => {
    sessionRef.current += 1;
    clearFinishTimer();
    const stop = stopRef.current;
    stopRef.current = null;
    pressRef.current = null;
    try {
      stop?.();
    } catch {
      // Already stopped.
    }
    if (mountedRef.current) {
      setPhase('idle');
      setInterim('');
    }
  }, [setPhase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelListening();
    };
  }, [cancelListening]);

  // The answer is on its way, or the screen is busy: stop the mic and ignore what it heard.
  useEffect(() => {
    if (disabled && phaseRef.current !== 'idle') cancelListening();
  }, [disabled, cancelListening]);

  const beginListening = (): boolean => {
    if (disabledRef.current || phaseRef.current !== 'idle') return false;
    // The phone's own voice must not be heard as the question.
    stopSpeaking();
    setHint(null);
    setInterim('');
    gestureRetryRef.current = false;
    const session = ++sessionRef.current;
    let delivered = false;
    let failed = false;
    const stop = startListening(lang, {
      onInterim: (heard) => {
        if (session !== sessionRef.current || !mountedRef.current || delivered) return;
        setInterim(heard.slice(0, QUESTION_MAX));
      },
      onResult: (transcript) => {
        if (session !== sessionRef.current || !mountedRef.current || delivered) return;
        const question = cleanQuestion(transcript);
        if (!question) return;
        delivered = true;
        setInterim('');
        onAskRef.current(question, 'voice');
      },
      onError: (code) => {
        if (session !== sessionRef.current || !mountedRef.current) return;
        failed = true;
        if (code === 'not-allowed') gestureRetryRef.current = true;
        setHint(micErrorText(code, bn));
      },
      onEnd: () => {
        if (session !== sessionRef.current) return;
        clearFinishTimer();
        stopRef.current = null;
        if (!mountedRef.current) return;
        setPhase('idle');
        setInterim('');
        if (!delivered && !failed) setHint(micErrorText('no-speech', bn));
      },
    });
    if (!stop) {
      setHint(bn ? 'এই ফোনে মুখে বলা যায় না। লিখে জিজ্ঞাসা করুন।' : 'Voice input is not available here. Please type your question.');
      return false;
    }
    stopRef.current = stop;
    setPhase('listening');
    return true;
  };

  /** The farmer has finished speaking: let the phone turn it into words. */
  const finishListening = () => {
    if (phaseRef.current !== 'listening') return;
    setPhase('finishing');
    try {
      stopRef.current?.();
    } catch {
      // Already stopped.
    }
    clearFinishTimer();
    const session = sessionRef.current;
    finishTimerRef.current = setTimeout(() => {
      // The browser never said it ended: do not leave the mic stuck.
      if (session !== sessionRef.current) return;
      sessionRef.current += 1;
      stopRef.current = null;
      if (mountedRef.current) {
        setPhase('idle');
        setInterim('');
      }
    }, FINISH_TIMEOUT_MS);
  };

  const toggle = () => {
    if (phaseRef.current === 'listening') finishListening();
    else if (phaseRef.current === 'idle') beginListening();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabledRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    try {
      // Keep getting the release even when the finger slides off the button.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not every browser allows it; the release is still seen on the button.
    }
    if (phaseRef.current === 'listening') {
      // Tapped again while listening: this press ends it.
      pressRef.current = { startedAt: Date.now(), startedHere: false };
    } else if (phaseRef.current === 'idle') {
      pressRef.current = beginListening() ? { startedAt: Date.now(), startedHere: true } : null;
    } else {
      pressRef.current = null;
    }
  };

  const onPointerUp = () => {
    lastPointerUpRef.current = Date.now();
    const press = pressRef.current;
    pressRef.current = null;
    if (!press) return;
    if (!press.startedHere || Date.now() - press.startedAt >= HOLD_MS) finishListening();
    // A quick tap keeps listening: it stops by itself, or on the next tap.
  };

  const onPointerCancel = () => {
    lastPointerUpRef.current = Date.now();
    const press = pressRef.current;
    pressRef.current = null;
    if (press?.startedHere) finishListening();
  };

  // Keyboard and screen-reader activation arrive as a click with no pointer
  // press before it. A click that follows a pointer release was handled above,
  // except when the phone refused to start listening from the first touch: the
  // click is a gesture it accepts, so try once more.
  const onClick = () => {
    if (disabledRef.current) return;
    if (Date.now() - lastPointerUpRef.current < CLICK_AFTER_POINTER_MS) {
      if (phaseRef.current === 'idle' && gestureRetryRef.current) beginListening();
      return;
    }
    toggle();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const question = cleanQuestion(text);
    if (!question) return;
    cancelListening();
    onAsk(question, 'text');
    setText('');
    setHint(null);
  };

  const listening = phase === 'listening';
  const finishing = phase === 'finishing';

  const micLabel = listening
    ? bn ? 'শুনছি' : 'Listening'
    : finishing
      ? bn ? 'বুঝছি' : 'One moment'
      : bn ? 'বলুন' : 'Speak';
  const micAria = listening
    ? bn ? 'থামান' : 'Stop'
    : finishing
      ? bn ? 'অপেক্ষা করুন' : 'Please wait'
      : bn ? 'বলুন। চেপে ধরে কথা বলুন, অথবা একবার ট্যাপ করুন' : 'Speak. Press and hold to talk, or tap once';

  const statusText = listening
    ? bn ? 'শুনছি… বলুন। শেষ হলে আঙুল তুলুন বা আবার ট্যাপ করুন।' : 'Listening… speak now. Lift your finger or tap again when you finish.'
    : finishing
      ? bn ? 'বুঝে নিচ্ছি…' : 'Working out what you said…'
      : hint;

  // The words heard so far. Hidden from screen readers: the status line above already says
  // the phone is listening, and a reader would otherwise repeat every partial word.
  const heardNow =
    (listening || finishing) && interim ? (
      <p
        aria-hidden="true"
        className="rounded-xl bg-stone-100 dark:bg-[#07140d] border border-stone-200 dark:border-emerald-900/50 px-3 py-2 text-base italic leading-snug text-stone-800 dark:text-stone-100 break-words"
      >
        {interim}
      </p>
    ) : null;

  const micButton = micAvailable ? (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      onContextMenu={(event) => event.preventDefault()}
      disabled={disabled && !listening && !finishing}
      aria-label={micAria}
      aria-pressed={listening}
      className={`shrink-0 inline-flex items-center justify-center select-none touch-none [-webkit-touch-callout:none] text-white font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/60 ${
        compact
          ? 'w-full min-h-[56px] gap-2 rounded-2xl text-lg'
          : 'flex-col gap-0.5 h-[76px] w-[76px] rounded-full text-sm shadow-md'
      } ${
        listening
          ? 'bg-red-600 motion-safe:animate-pulse'
          : finishing
            ? 'bg-stone-500'
            : 'bg-emerald-700 hover:bg-emerald-800'
      }`}
    >
      {finishing ? (
        <Loader2 className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} animate-spin`} aria-hidden="true" />
      ) : (
        <Mic className={compact ? 'w-6 h-6' : 'w-7 h-7'} aria-hidden="true" />
      )}
      <span>{micLabel}</span>
    </button>
  ) : null;

  const status = (
    <p
      role="status"
      aria-live="polite"
      className={statusText ? 'text-sm font-bold text-stone-700 dark:text-stone-200 leading-snug' : 'sr-only'}
    >
      {statusText}
    </p>
  );

  const textForm = (
    <form onSubmit={submit} className="flex flex-1 min-w-0 items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        {bn ? 'আপনার প্রশ্ন' : 'Your question'}
      </label>
      <input
        id={inputId}
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={QUESTION_MAX}
        enterKeyHint="send"
        autoComplete="off"
        placeholder={placeholder ?? (bn ? 'লিখে জিজ্ঞাসা করুন' : 'Type here')}
        className="flex-1 min-w-0 min-h-[48px] rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 bg-white dark:bg-[#07140d] px-4 text-base text-stone-900 dark:text-white placeholder:text-stone-500 dark:placeholder:text-stone-400 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label={bn ? 'পাঠান' : 'Send'}
        className="shrink-0 inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full bg-emerald-700 text-white disabled:opacity-40 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/60"
      >
        <Send className="w-5 h-5" aria-hidden="true" />
      </button>
    </form>
  );

  if (compact) {
    return (
      <div className="w-full space-y-2">
        {micButton}
        {status}
        {heardNow}
        {textForm}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {status}
      {heardNow}
      <div className="flex items-center gap-3">
        {micButton}
        {textForm}
      </div>
      {!micAvailable && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {bn ? 'এই ব্রাউজারে মুখে বলা যায় না। লিখে জিজ্ঞাসা করুন।' : 'Voice input is not available in this browser. Please type your question.'}
        </p>
      )}
    </div>
  );
}
