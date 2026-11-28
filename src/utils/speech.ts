/**
 * One place for reading text aloud and for voice input.
 *
 * Both use the browser's own speech features, which cost nothing and work
 * without the AI allowance. Screens that want the higher-quality AI voice call
 * `generateSpeech` themselves and fall back to `speakWithBrowser`.
 */

export type SpeechLang = 'bn' | 'en';

const localeFor = (lang: SpeechLang): string => (lang === 'bn' ? 'bn-BD' : 'en-US');

/** Text with markdown marks removed, so they are not read out as symbols. */
export const plainSpeechText = (text: string): string =>
  String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*#_`>|~]/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

export const canSpeak = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
}

/** What happened when we tried to read aloud. */
export type SpeakResult = 'started' | 'no-voice' | 'unsupported';

/**
 * True when one of the voices speaks the language. Bangla needs its own voice:
 * an English voice reading Bangla letters only makes noise. Only Bangla is
 * checked, because every device has some English voice.
 */
export const hasVoiceForLang = (voices: ReadonlyArray<{ lang?: string }>, lang: SpeechLang): boolean => {
  if (lang !== 'bn') return true;
  return voices.some((voice) => String(voice?.lang || '').toLowerCase().replace('_', '-').startsWith('bn'));
};

const installedVoices = (): SpeechSynthesisVoice[] => {
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
};

/**
 * The installed voices. Many browsers load them a moment after the page opens
 * (the `voiceschanged` event), so when the list is empty this waits briefly.
 */
export const waitForVoices = (timeoutMs = 1000): Promise<SpeechSynthesisVoice[]> => {
  if (!canSpeak()) return Promise.resolve([]);
  const now = installedVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    const synth = window.speechSynthesis;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        synth.removeEventListener?.('voiceschanged', finish);
      } catch {
        // Nothing to remove.
      }
      resolve(installedVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    try {
      synth.addEventListener?.('voiceschanged', finish);
    } catch {
      // The timer still ends the wait.
    }
  });
};

/**
 * Read text aloud with the device's voice. Returns false when the device
 * cannot speak or there is nothing to say, so the caller can show a message.
 * It also returns false when the voice list is loaded and has no voice for the
 * language (use `speakChecked` to tell the two apart).
 */
export const speakWithBrowser = (text: string, lang: SpeechLang, options: SpeakOptions = {}): boolean => {
  if (!canSpeak()) return false;
  const plain = plainSpeechText(text);
  if (!plain) return false;
  try {
    const voices = installedVoices();
    // An empty list may just mean the voices are still loading, so only a loaded list can say no.
    if (voices.length > 0 && !hasVoiceForLang(voices, lang)) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.lang = localeFor(lang);
    utterance.rate = options.rate ?? 0.95;
    if (options.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
};

/**
 * Like `speakWithBrowser`, but says why it did not start: the device cannot
 * speak at all, or it has no voice for the language (for Bangla, none is
 * installed). It waits briefly for the voice list when it is still loading.
 * When the voices are already loaded it speaks at once, inside the tap.
 */
export const speakChecked = async (text: string, lang: SpeechLang, options: SpeakOptions = {}): Promise<SpeakResult> => {
  if (!canSpeak() || !plainSpeechText(text)) return 'unsupported';
  if (lang === 'bn' && installedVoices().length === 0) {
    const voices = await waitForVoices();
    if (voices.length > 0 && !hasVoiceForLang(voices, lang)) return 'no-voice';
  } else if (!hasVoiceForLang(installedVoices(), lang)) {
    return 'no-voice';
  }
  return speakWithBrowser(text, lang, options) ? 'started' : 'unsupported';
};

export const stopSpeaking = (): void => {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Nothing was speaking.
  }
};

const recognitionClass = (): any =>
  typeof window === 'undefined'
    ? null
    : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

export const canListen = (): boolean => !!recognitionClass();

export interface ListenHandlers {
  onResult: (transcript: string) => void;
  onEnd?: () => void;
  /** `code` is the browser's error name, such as `not-allowed` or `no-speech`. */
  onError?: (code: string) => void;
}

/**
 * Listen for one spoken phrase. Returns a function that stops listening, or
 * null when the browser has no voice input.
 */
export const startListening = (lang: SpeechLang, handlers: ListenHandlers): (() => void) | null => {
  const Recognition = recognitionClass();
  if (!Recognition) return null;
  try {
    const recognition = new Recognition();
    recognition.lang = localeFor(lang);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) handlers.onResult(transcript);
    };
    recognition.onerror = (event: any) => handlers.onError?.(String(event?.error || 'unknown'));
    recognition.onend = () => handlers.onEnd?.();
    recognition.start();
    return () => {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    };
  } catch {
    handlers.onError?.('unknown');
    return null;
  }
};
