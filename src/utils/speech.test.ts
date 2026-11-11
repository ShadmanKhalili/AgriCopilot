import { describe, expect, it } from 'vitest';
import { canListen, canSpeak, plainSpeechText, speakWithBrowser, startListening } from './speech';

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
