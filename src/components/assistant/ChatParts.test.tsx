import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ASSISTANT_NAME } from '../../constants/assistant';
import { EmptyState, FailureCard, MessageBubble, ThinkingBubble } from './ChatParts';
import { errorView, type ChatItem } from './assistantView';

const item = (over: Partial<ChatItem>): ChatItem => ({
  key: 'k1',
  role: 'assistant',
  text: 'আজ স্প্রে করবেন না।',
  channel: 'text',
  createdAt: null,
  saved: true,
  ...over,
});

describe('MessageBubble', () => {
  it('shows the farmer\'s own message on the right with a mic mark for a spoken one', () => {
    const typed = renderToStaticMarkup(<MessageBubble item={item({ role: 'user', text: 'আলুর দাম কত?' })} lang="bn" />);
    expect(typed).toContain('justify-end');
    expect(typed).toContain('আলুর দাম কত?');
    expect(typed).not.toContain('lucide-mic');

    const spoken = renderToStaticMarkup(<MessageBubble item={item({ role: 'user', channel: 'voice', text: 'আলুর দাম কত?' })} lang="bn" />);
    expect(spoken).toContain('lucide-mic');
  });

  it('shows an answer with a Listen button and the sources the server named', () => {
    const html = renderToStaticMarkup(
      <MessageBubble item={item({ sources: ['rules', 'weather_forecast'] })} lang="bn" />
    );
    expect(html).toContain('আজ স্প্রে করবেন না।');
    expect(html).toContain('শুনুন');
    expect(html).toContain('নিয়ম অনুযায়ী');
    expect(html).toContain('আবহাওয়ার পূর্বাভাস');
    expect(html).toContain('তথ্যের উৎস');
    expect(html).toContain(ASSISTANT_NAME.bn);
  });

  it('marks an AI estimate differently from the rest', () => {
    const html = renderToStaticMarkup(<MessageBubble item={item({ sources: ['ai_estimate', 'rules'] })} lang="bn" />);
    const estimate = html.slice(html.indexOf('এআই অনুমান') - 200, html.indexOf('এআই অনুমান'));
    expect(estimate).toContain('amber');
  });

  it('shows the sources of a saved answer from the tools it used', () => {
    const html = renderToStaticMarkup(
      <MessageBubble item={item({ toolCalls: [{ name: 'get_market_price', status: 'done' }] })} lang="bn" />
    );
    expect(html).toContain('সরকারি বাজারদর');
  });

  it('shows no source list when there is nothing to label', () => {
    const html = renderToStaticMarkup(<MessageBubble item={item({})} lang="bn" />);
    expect(html).not.toContain('তথ্যের উৎস');
  });

  it('says when an answer could not be saved, but still shows it', () => {
    const html = renderToStaticMarkup(<MessageBubble item={item({ saved: false })} lang="bn" />);
    expect(html).toContain('আজ স্প্রে করবেন না।');
    expect(html).toContain('সংরক্ষণ করা যায়নি');
  });

  it('keeps line breaks of the answer', () => {
    const html = renderToStaticMarkup(<MessageBubble item={item({ text: 'এক\nদুই' })} lang="bn" />);
    expect(html).toContain('whitespace-pre-line');
  });

  it('reads in English', () => {
    const html = renderToStaticMarkup(<MessageBubble item={item({ text: 'Do not spray today.', sources: ['govt_bulletin'] })} lang="en" />);
    expect(html).toContain('Listen');
    expect(html).toContain('Government price bulletin');
    expect(html).toContain(ASSISTANT_NAME.en);
  });
});

describe('ThinkingBubble', () => {
  it('says it is thinking', () => {
    expect(renderToStaticMarkup(<ThinkingBubble lang="bn" />)).toContain('ভাবছি');
    expect(renderToStaticMarkup(<ThinkingBubble lang="en" />)).toContain('Thinking');
  });
});

describe('FailureCard', () => {
  it('offers a retry and the helpline when asking again can help', () => {
    const html = renderToStaticMarkup(<FailureCard view={errorView('server', 'bn')} lang="bn" onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('এই মুহূর্তে উত্তর দেওয়া গেল না');
    expect(html).toContain('আবার চেষ্টা করুন');
    expect(html).toContain('tel:16123');
    expect(html).toContain('১৬১২৩');
  });

  it('offers no retry when the day\'s allowance is spent', () => {
    const html = renderToStaticMarkup(<FailureCard view={errorView('limit', 'bn')} lang="bn" onRetry={() => {}} />);
    expect(html).toContain('আজকের জিজ্ঞাসার সীমা শেষ');
    expect(html).not.toContain('আবার চেষ্টা করুন');
    expect(html).toContain('tel:16123');
  });

  it('offers only a retry when the phone is offline', () => {
    const html = renderToStaticMarkup(<FailureCard view={errorView('offline', 'bn')} lang="bn" onRetry={() => {}} />);
    expect(html).toContain('ইন্টারনেট নেই');
    expect(html).toContain('আবার চেষ্টা করুন');
    expect(html).not.toContain('tel:16123');
  });
});

describe('EmptyState', () => {
  it('greets by name and offers the three example questions', () => {
    const html = renderToStaticMarkup(<EmptyState lang="bn" onPick={() => {}} isGuest={false} />);
    expect(html).toContain(`আমি ${ASSISTANT_NAME.bn}`);
    expect(html).toContain('আজ কি স্প্রে করতে পারি?');
    expect(html).toContain('এই মৌসুমে এ পর্যন্ত কত খরচ হয়েছে?');
    expect(html).toContain('আলুর দাম কত?');
    expect(html).toContain('১৬১২৩');
    expect(html).not.toContain('গেস্ট');
  });

  it('gives each example a big tap target', () => {
    const html = renderToStaticMarkup(<EmptyState lang="bn" onPick={() => {}} isGuest={false} />);
    expect((html.match(/min-h-\[56px\]/g) ?? []).length).toBe(3);
  });

  it('tells a guest that the conversation stays on this account, and links to the profile when it can', () => {
    const withLink = renderToStaticMarkup(<EmptyState lang="bn" onPick={() => {}} isGuest onOpenProfile={() => {}} />);
    expect(withLink).toContain('গেস্ট');
    expect(withLink).toContain('প্রোফাইলে যান');
    const withoutLink = renderToStaticMarkup(<EmptyState lang="bn" onPick={() => {}} isGuest />);
    expect(withoutLink).toContain('গেস্ট');
    expect(withoutLink).not.toContain('প্রোফাইলে যান');
  });

  it('reads in English with English examples', () => {
    const html = renderToStaticMarkup(<EmptyState lang="en" onPick={() => {}} isGuest={false} />);
    expect(html).toContain(`I am ${ASSISTANT_NAME.en}`);
    expect(html).toContain('Can I spray today?');
    expect(html).not.toMatch(/[ঀ-৿]/);
  });
});
