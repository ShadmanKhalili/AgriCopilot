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

/**
 * Read text aloud with the device's voice. Returns false when the device
 * cannot speak or there is nothing to say, so the caller can show a message.
 */
export const speakWithBrowser = (text: string, lang: SpeechLang, options: SpeakOptions = {}): boolean => {
  if (!canSpeak()) return false;
  const plain = plainSpeechText(text);
  if (!plain) return false;
  try {
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
