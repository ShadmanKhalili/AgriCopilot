import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_MAX_TURNS,
  HISTORY_TEXT_MAX,
  QUESTION_MAX,
  SAVE_TEXT_MAX,
  buildHistory,
  chatItemFromThread,
  cleanQuestion,
  clampText,
  errorKindOf,
  errorView,
  exampleQuestions,
  guestStartErrorText,
  helplineText,
  mergeLoadedItems,
  orderChatItems,
  requestLocation,
  sourceLabel,
  sourcesForItem,
  textForSave,
  todayForRequest,
  withTimeout,
  SOURCE_BY_TOOL,
  type ChatItem,
} from './assistantView';
import { safetyBlockMessage } from '../../utils/safetyBlock';

const item = (over: Partial<ChatItem> & Pick<ChatItem, 'key' | 'role'>): ChatItem => ({
  text: `text ${over.key}`,
  channel: 'text',
  createdAt: null,
  saved: true,
  ...over,
});

describe('clampText and cleanQuestion', () => {
  it('cuts to the limit and never leaves half an emoji', () => {
    expect(clampText('abcdef', 3)).toBe('abc');
    expect(clampText('abc', 3)).toBe('abc');
    // The emoji is two code units; cutting between them would leave a broken character.
    expect(clampText('ab😀', 3)).toBe('ab');
  });

  it('tidies a question to one line and cuts it to 2000 characters', () => {
    expect(cleanQuestion('  আলুর   দাম\nকত?  ')).toBe('আলুর দাম কত?');
    expect(cleanQuestion('x'.repeat(QUESTION_MAX + 50))).toHaveLength(QUESTION_MAX);
  });

  it('gives null when there is nothing to ask', () => {
    expect(cleanQuestion('   \n ')).toBeNull();
    expect(cleanQuestion('')).toBeNull();
    expect(cleanQuestion(undefined)).toBeNull();
    expect(cleanQuestion(42)).toBeNull();
  });
});

describe('chatItemFromThread', () => {
  it('keeps what the screen needs and marks it saved', () => {
    const made = chatItemFromThread({
      id: 'm1',
      role: 'assistant',
      text: 'উত্তর',
      channel: 'voice',
      createdAt: '2026-11-28T04:00:00.000Z',
      toolCalls: [{ name: 'get_my_money', status: 'done' }],
    });
    expect(made).toEqual({
      key: 'm1',
      role: 'assistant',
      text: 'উত্তর',
      channel: 'voice',
      createdAt: '2026-11-28T04:00:00.000Z',
      toolCalls: [{ name: 'get_my_money', status: 'done' }],
      saved: true,
    });
  });

  it('leaves out an empty tool call list', () => {
    const made = chatItemFromThread({ id: 'm2', role: 'user', text: 'হ্যালো', channel: 'text', createdAt: null, toolCalls: [] });
    expect('toolCalls' in made).toBe(false);
  });
});

describe('orderChatItems', () => {
  it('sorts stamped messages oldest first', () => {
    const ordered = orderChatItems([
      item({ key: 'c', role: 'user', createdAt: '2026-11-28T03:00:00.000Z' }),
      item({ key: 'a', role: 'user', createdAt: '2026-11-28T01:00:00.000Z' }),
      item({ key: 'b', role: 'assistant', createdAt: '2026-11-28T02:00:00.000Z' }),
    ]);
    expect(ordered.map((m) => m.key)).toEqual(['a', 'b', 'c']);
  });

  it('puts messages with no time yet after the stamped ones, in the order they were made', () => {
    const ordered = orderChatItems([
      item({ key: 'local-1', role: 'user' }),
      item({ key: 'local-2', role: 'assistant' }),
      item({ key: 'old', role: 'user', createdAt: '2026-11-28T01:00:00.000Z' }),
    ]);
    expect(ordered.map((m) => m.key)).toEqual(['old', 'local-1', 'local-2']);
  });

  it('keeps the incoming order when times are equal and does not change its input', () => {
    const input = [
      item({ key: 'q', role: 'user', createdAt: '2026-11-28T01:00:00.000Z' }),
      item({ key: 'r', role: 'assistant', createdAt: '2026-11-28T01:00:00.000Z' }),
    ];
    const copy = [...input];
    expect(orderChatItems(input).map((m) => m.key)).toEqual(['q', 'r']);
    expect(input).toEqual(copy);
  });
});

describe('buildHistory', () => {
  const exchange = (n: number): ChatItem[] => [
    item({ key: `q${n}`, role: 'user', text: `question ${n}` }),
    item({ key: `a${n}`, role: 'assistant', text: `answer ${n}` }),
  ];

  it('gives nothing for an empty conversation', () => {
    expect(buildHistory([])).toEqual([]);
  });

  it('sends the turns oldest first as role and text only', () => {
    expect(buildHistory([...exchange(1), ...exchange(2)])).toEqual([
      { role: 'user', text: 'question 1' },
      { role: 'assistant', text: 'answer 1' },
      { role: 'user', text: 'question 2' },
      { role: 'assistant', text: 'answer 2' },
    ]);
  });

  it('keeps only the last 12 turns', () => {
    const all = Array.from({ length: 10 }, (_, n) => exchange(n)).flat(); // 20 turns
    const history = buildHistory(all);
    expect(history).toHaveLength(HISTORY_MAX_TURNS);
    expect(history[0]).toEqual({ role: 'user', text: 'question 4' });
    expect(history[history.length - 1]).toEqual({ role: 'assistant', text: 'answer 9' });
  });

  it('never starts with an answer whose question was cut off', () => {
    // 13 turns (the last is a second answer in a row); the last 12 begin with
    // answer 0, which is dropped so the history starts on question 1.
    const all = [...Array.from({ length: 6 }, (_, n) => exchange(n)).flat(), item({ key: 'extra', role: 'assistant', text: 'extra answer' })];
    const history = buildHistory(all);
    expect(history[0]).toEqual({ role: 'user', text: 'question 1' });
    expect(history).toHaveLength(HISTORY_MAX_TURNS - 1);
    expect(history[history.length - 1]).toEqual({ role: 'assistant', text: 'extra answer' });
  });

  it('leaves out a question that has no answer yet, such as the one being asked now', () => {
    const history = buildHistory([...exchange(1), item({ key: 'now', role: 'user', text: 'the new question' })]);
    expect(history.map((t) => t.text)).toEqual(['question 1', 'answer 1']);
  });

  it('leaves out an earlier question whose answer never came', () => {
    const history = buildHistory([
      item({ key: 'failed', role: 'user', text: 'failed question' }),
      ...exchange(2),
    ]);
    expect(history.map((t) => t.text)).toEqual(['question 2', 'answer 2']);
  });

  it('drops empty messages and trims each turn to the limit', () => {
    const history = buildHistory([
      item({ key: 'q', role: 'user', text: '  ' + 'ক'.repeat(HISTORY_TEXT_MAX + 10) + '  ' }),
      item({ key: 'blank', role: 'assistant', text: '   ' }),
      item({ key: 'a', role: 'assistant', text: ' উত্তর ' }),
    ]);
    expect(history).toHaveLength(2);
    expect(history[0].text).toHaveLength(HISTORY_TEXT_MAX);
    expect(history[1]).toEqual({ role: 'assistant', text: 'উত্তর' });
  });
});

describe('buildHistory and the diagnosis line', () => {
  it('keeps the crop doctor\'s diagnosis line when it opens the history', () => {
    const history = buildHistory([
      item({ key: 'd', role: 'assistant', text: 'রোগ নির্ণয়: নাবি ধসা (আলু)', channel: 'photo' }),
      item({ key: 'q', role: 'user', text: 'কী করব?', channel: 'photo' }),
      item({ key: 'a', role: 'assistant', text: 'স্প্রে করুন' }),
    ]);
    expect(history.map((t) => t.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(history[0].text).toBe('রোগ নির্ণয়: নাবি ধসা (আলু)');
  });

  it('still drops an ordinary answer whose question was cut off', () => {
    const history = buildHistory([
      item({ key: 'x', role: 'assistant', text: 'orphan answer' }),
      item({ key: 'q', role: 'user', text: 'q' }),
      item({ key: 'a', role: 'assistant', text: 'a' }),
    ]);
    expect(history.map((t) => t.text)).toEqual(['q', 'a']);
  });
});

describe('mergeLoadedItems', () => {
  const saved = [
    item({ key: 's1', role: 'user', text: 'saved q', createdAt: '2026-11-01T00:00:00.000Z' }),
    item({ key: 's2', role: 'assistant', text: 'saved a', createdAt: '2026-11-01T00:00:01.000Z' }),
  ];

  it('shows the saved conversation and keeps only the phone\'s messages the account does not have', () => {
    const current = [
      item({ key: 'local-1', role: 'user', text: 'kept already' }),
      item({ key: 'local-2', role: 'user', text: 'not kept yet' }),
      item({ key: 'old-id', role: 'assistant', text: 'deleted elsewhere', createdAt: '2026-10-01T00:00:00.000Z' }),
    ];
    const merged = mergeLoadedItems(saved, current, new Set(['local-2']));
    expect(merged.map((m) => m.key)).toEqual(['s1', 's2', 'local-2']);
  });

  it('shows messages the crop doctor saved meanwhile', () => {
    const more = [...saved, item({ key: 's3', role: 'assistant', text: 'diagnosis', channel: 'photo', createdAt: '2026-11-02T00:00:00.000Z' })];
    expect(mergeLoadedItems(more, saved, new Set()).map((m) => m.key)).toEqual(['s1', 's2', 's3']);
  });
});

describe('todayForRequest', () => {
  it('adds the reading time to the weather numbers', () => {
    expect(todayForRequest({ readingAt: '2026-11-29T05:00:00.000Z', weather: { temp: 29, rainChanceToday: 20 } })).toEqual({
      readingAt: '2026-11-29T05:00:00.000Z',
      temp: 29,
      rainChanceToday: 20,
    });
  });
  it('gives nothing when there is no reading', () => {
    expect(todayForRequest(null)).toBeUndefined();
  });
});

describe('errorKindOf', () => {
  it('reads the kind of an assistant error', () => {
    expect(errorKindOf({ kind: 'offline' })).toBe('offline');
    expect(errorKindOf(Object.assign(new Error('x'), { kind: 'limit' }))).toBe('limit');
  });

  it('treats anything else as a server problem', () => {
    expect(errorKindOf(new Error('boom'))).toBe('server');
    expect(errorKindOf({ kind: 'weird' })).toBe('server');
    expect(errorKindOf(null)).toBe('server');
    expect(errorKindOf(undefined)).toBe('server');
  });
});

describe('errorView', () => {
  it('has Bangla and English words for every kind', () => {
    for (const kind of ['offline', 'limit', 'capacity', 'auth', 'server', 'blocked'] as const) {
      const bn = errorView(kind, 'bn');
      const en = errorView(kind, 'en');
      expect(bn.text).toMatch(/[ঀ-৿]/);
      expect(bn.text).not.toMatch(/[A-Za-z]{4,}/);
      expect(en.text).toMatch(/^[\x20-\x7E]+$/);
      expect(bn.canRetry).toBe(en.canRetry);
    }
  });

  it('does not offer a retry when the daily allowance is spent, and points to the helpline', () => {
    const limit = errorView('limit', 'bn');
    expect(limit.canRetry).toBe(false);
    expect(limit.showHelpline).toBe(true);
  });

  it('shows the app\'s safety message for a blocked question and offers no retry', () => {
    for (const lang of ['bn', 'en'] as const) {
      const view = errorView('blocked', lang);
      expect(view.text).toBe(safetyBlockMessage(lang));
      expect(view.canRetry).toBe(false);
      expect(view.showHelpline).toBe(false);
    }
    expect(errorKindOf({ kind: 'blocked' })).toBe('blocked');
  });

  it('offers a retry when it may work now or soon', () => {
    for (const kind of ['offline', 'capacity', 'auth', 'server'] as const) {
      expect(errorView(kind, 'bn').canRetry).toBe(true);
    }
  });

  it('shows the helpline only where a phone call helps', () => {
    expect(errorView('offline', 'bn').showHelpline).toBe(false);
    expect(errorView('auth', 'bn').showHelpline).toBe(false);
    expect(errorView('server', 'bn').showHelpline).toBe(true);
    expect(errorView('capacity', 'bn').showHelpline).toBe(true);
  });
});

describe('helplineText', () => {
  it('uses Bangla numerals in Bangla', () => {
    expect(helplineText('bn')).toBe('কৃষি কল সেন্টারে ফোন করুন: ১৬১২৩');
    expect(helplineText('en')).toBe('Call the Krishi Call Centre: 16123');
  });
});

describe('guestStartErrorText', () => {
  it('names a guest mode that is switched off', () => {
    expect(guestStartErrorText({ code: 'auth/operation-not-allowed' }, 'bn')).toContain('Google');
    expect(guestStartErrorText({ code: 'auth/admin-restricted-operation' }, 'en')).toContain('Google');
  });

  it('names a missing connection', () => {
    expect(guestStartErrorText({ code: 'auth/network-request-failed' }, 'en')).toContain('internet');
    expect(guestStartErrorText({ code: 'auth/network-request-failed' }, 'bn')).toContain('ইন্টারনেট');
  });

  it('falls back to a plain message', () => {
    expect(guestStartErrorText(new Error('x'), 'bn')).toMatch(/[ঀ-৿]/);
    expect(guestStartErrorText(undefined, 'en')).toContain('guest');
  });
});

describe('sourcesForItem', () => {
  it('uses the sources the server listed, in a fixed order and once each', () => {
    const sources = sourcesForItem({
      role: 'assistant',
      sources: ['govt_bulletin', 'rules', 'govt_bulletin'],
      toolCalls: [{ name: 'get_my_money', status: 'done' }],
    });
    expect(sources).toEqual(['rules', 'govt_bulletin']);
  });

  it('shows no sources when the server listed none', () => {
    expect(sourcesForItem({ role: 'assistant', sources: [] })).toEqual([]);
  });

  it('works out the sources of a saved answer from the tools that finished', () => {
    const sources = sourcesForItem({
      role: 'assistant',
      toolCalls: [
        { name: 'get_week_forecast', status: 'done' },
        { name: 'get_market_price', status: 'failed' },
        { name: 'get_my_money', status: 'done' },
        { name: 'some_future_tool', status: 'done' },
      ],
    });
    expect(sources).toEqual(['farmer_records', 'weather_forecast']);
  });

  it('covers exactly the server\'s read tools', () => {
    expect(SOURCE_BY_TOOL).toEqual({
      get_today_farm_actions: ['rules'],
      get_week_forecast: ['weather_forecast'],
      get_my_season: ['farmer_records'],
      get_my_money: ['farmer_records'],
      get_market_price: ['govt_bulletin'],
      get_area_warnings: ['app_data'],
      get_open_tasks: ['farmer_records'],
      lookup_disease: ['app_data'],
    });
  });

  it('shows nothing for the farmer\'s own messages or answers without tools', () => {
    expect(sourcesForItem({ role: 'user', sources: ['rules'] })).toEqual([]);
    expect(sourcesForItem({ role: 'assistant' })).toEqual([]);
  });

  it('has a label in both languages for every source', () => {
    for (const source of ['rules', 'farmer_records', 'govt_bulletin', 'weather_forecast', 'ai_estimate', 'app_data'] as const) {
      expect(sourceLabel(source, 'bn')).toMatch(/[ঀ-৿]/);
      expect(sourceLabel(source, 'en')).toMatch(/[A-Za-z]/);
    }
  });
});

describe('exampleQuestions', () => {
  it('offers the three questions the assistant is built to answer', () => {
    expect(exampleQuestions('bn')).toEqual(['আজ কি স্প্রে করতে পারি?', 'এই মৌসুমে এ পর্যন্ত কত খরচ হয়েছে?', 'আলুর দাম কত?']);
    expect(exampleQuestions('en')).toHaveLength(3);
  });
});

describe('requestLocation', () => {
  it('rounds to 2 decimals', () => {
    expect(requestLocation({ latitude: 24.37456, longitude: 88.60409 })).toEqual({ lat: 24.37, lon: 88.6 });
  });

  it('gives nothing when there is no usable position', () => {
    expect(requestLocation(null)).toBeUndefined();
    expect(requestLocation(undefined)).toBeUndefined();
    expect(requestLocation({ latitude: NaN, longitude: 90 })).toBeUndefined();
  });
});

describe('textForSave', () => {
  it('trims and keeps an answer within what the account stores', () => {
    expect(textForSave('  উত্তর  ')).toBe('উত্তর');
    expect(textForSave('x'.repeat(SAVE_TEXT_MAX + 5))).toHaveLength(SAVE_TEXT_MAX);
  });
});

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the value through when the promise is quick', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it('passes the error through when the promise fails', async () => {
    await expect(withTimeout(Promise.reject(new Error('nope')), 1000)).rejects.toThrow('nope');
  });

  it('rejects when the promise is too slow', async () => {
    vi.useFakeTimers();
    const slow = new Promise<number>(() => {});
    const result = withTimeout(slow, 500);
    const check = expect(result).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(501);
    await check;
  });
});
