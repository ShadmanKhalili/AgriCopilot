import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AskBar } from './AskBar';

type Fake = { window?: unknown };

/** Render with a browser that has voice input, or without one. */
const render = (element: React.ReactElement, voice: boolean): string => {
  const g = globalThis as unknown as Fake;
  if (voice) g.window = { webkitSpeechRecognition: class {} };
  try {
    return renderToStaticMarkup(element);
  } finally {
    delete g.window;
  }
};

describe('AskBar', () => {
  it('shows a big Bangla mic button, the text box and a send button', () => {
    const html = render(<AskBar lang="bn" onAsk={() => {}} />, true);
    expect(html).toContain('বলুন');
    expect(html).toContain('h-[76px] w-[76px]');
    expect(html).toContain('aria-label="পাঠান"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain('enterKeyHint="send"');
    // The label for the text box is for screen readers.
    expect(html).toContain('আপনার প্রশ্ন');
    // Nothing typed yet, so there is nothing to send.
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('keeps every target at least 48px', () => {
    const html = render(<AskBar lang="bn" onAsk={() => {}} />, true);
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('min-w-[48px]');
  });

  it('reads in English', () => {
    const html = render(<AskBar lang="en" onAsk={() => {}} />, true);
    expect(html).toContain('Speak');
    expect(html).toContain('aria-label="Send"');
    expect(html).toContain('Type here');
    expect(html).not.toMatch(/[ঀ-৿]/);
  });

  it('hides the mic when the browser has no voice input, and says why', () => {
    const html = render(<AskBar lang="bn" onAsk={() => {}} />, false);
    expect(html).not.toContain('বলুন');
    expect(html).not.toContain('aria-pressed');
    expect(html).toContain('এই ব্রাউজারে মুখে বলা যায় না');
    expect(html).toContain('aria-label="পাঠান"');
  });

  it('uses a wide mic button above the text box in the compact version', () => {
    const html = render(<AskBar lang="bn" compact onAsk={() => {}} />, true);
    expect(html).toContain('w-full min-h-[56px]');
    expect(html).not.toContain('h-[76px]');
    expect(html.indexOf('বলুন')).toBeLessThan(html.indexOf('type="text"'));
  });

  it('shows no voice note in the compact version without voice input', () => {
    const html = render(<AskBar lang="bn" compact onAsk={() => {}} />, false);
    expect(html).not.toContain('এই ব্রাউজারে মুখে বলা যায় না');
    expect(html).toContain('type="text"');
  });

  it('uses the placeholder it is given', () => {
    const html = render(<AskBar lang="bn" onAsk={() => {}} placeholder="যেমন: আলুর দাম" />, true);
    expect(html).toContain('placeholder="যেমন: আলুর দাম"');
  });

  it('turns the mic and the send button off while an answer is on its way', () => {
    const html = render(<AskBar lang="bn" disabled onAsk={() => {}} />, true);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*disabled|<button[^>]*disabled[^>]*aria-pressed="false"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('has a live status region for what the mic is doing', () => {
    const html = render(<AskBar lang="bn" onAsk={() => {}} />, true);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
