import { afterEach, describe, expect, it, vi } from 'vitest';
import { canListen, canSpeak, hasVoiceForLang, plainSpeechText, speakChecked, speakWithBrowser, startListening } from './speech';

describe('plainSpeechText', () => {
  it('removes markdown marks so they are not read out', () => {
    expect(plainSpeechText('## Blast\n- **Spray** in the `evening`')).toBe('Blast Spray in the evening');
  });

  it('keeps the words of a link and drops its address', () => {
    expect(plainSpeechText('Call [the helpline](tel:16123) now')).toBe('Call the helpline now');
  });

  it('keeps Bangla text and hyphens inside words', () => {
    expect(plainSpeechText('**ধানের ব্লাস্ট** রোগ, ১০-১২ দিন')).toBe('ধানের ব্লাস্ট রোগ, ১০-১২ দিন');
  });

  it('returns an empty string for nothing', () => {
    expect(plainSpeechText('')).toBe('');
    expect(plainSpeechText(undefined as unknown as string)).toBe('');
  });
});

describe('without a browser', () => {
  it('reports that it cannot speak or listen instead of throwing', () => {
    expect(canSpeak()).toBe(false);
    expect(canListen()).toBe(false);
    expect(speakWithBrowser('hello', 'en')).toBe(false);
    expect(startListening('bn', { onResult: () => undefined })).toBeNull();
  });
});

describe('hasVoiceForLang', () => {
  it('finds a Bangla voice by its language tag', () => {
    expect(hasVoiceForLang([{ lang: 'en-US' }, { lang: 'bn-BD' }], 'bn')).toBe(true);
    expect(hasVoiceForLang([{ lang: 'bn_IN' }], 'bn')).toBe(true);
    expect(hasVoiceForLang([{ lang: 'BN-bd' }], 'bn')).toBe(true);
  });

  it('says no when only other languages are installed', () => {
    expect(hasVoiceForLang([{ lang: 'en-US' }, { lang: 'hi-IN' }], 'bn')).toBe(false);
    expect(hasVoiceForLang([], 'bn')).toBe(false);
    expect(hasVoiceForLang([{}], 'bn')).toBe(false);
  });

  it('does not check English', () => {
    expect(hasVoiceForLang([], 'en')).toBe(true);
  });
});

describe('speakChecked with a fake speech engine', () => {
  const install = (voices: Array<{ lang: string }>) => {
    const speak = vi.fn();
    const synth = {
      getVoices: () => voices,
      cancel: vi.fn(),
      speak,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('window', { speechSynthesis: synth });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    return speak;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('speaks Bangla when a Bangla voice is installed', async () => {
    const speak = install([{ lang: 'bn-BD' }]);
    expect(await speakChecked('ধান', 'bn')).toBe('started');
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('does not read Bangla with an English voice', async () => {
    const speak = install([{ lang: 'en-US' }]);
    expect(await speakChecked('ধান', 'bn')).toBe('no-voice');
    expect(speak).not.toHaveBeenCalled();
    expect(speakWithBrowser('ধান', 'bn')).toBe(false);
  });

  it('still speaks English with only an English voice', async () => {
    const speak = install([{ lang: 'en-US' }]);
    expect(await speakChecked('rice', 'en')).toBe('started');
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
