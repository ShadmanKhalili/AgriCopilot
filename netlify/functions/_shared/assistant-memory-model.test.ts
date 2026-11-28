import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MEMORY_CATEGORIES,
  MEMORY_TEXT_MAX,
  MEMORY_TEXT_MIN,
  MESSAGE_CHANNELS,
  MESSAGE_ROLES,
  TOOL_CALL_STATUSES,
  TOOL_NAME_MAX,
  MESSAGE_TEXT_MAX,
  THREAD_SUMMARY_MAX,
  THREAD_TITLE_MAX,
  TOOL_CALLS_MAX,
  cleanMemoryInput,
  cleanMemoryText,
  cleanMessageInput,
  cleanThreadSummary,
  cleanThreadTitle,
  cleanToolCalls,
  isMemoryCategory,
  isValidDocId,
  isValidMessageCount,
  memoryTextChange,
  newMemoryFactData,
  parseMemoryFact,
  sortMemoryFacts,
  tidyLine,
  toIsoTime,
} from './assistant-memory-model.ts';

describe('cleanMemoryText', () => {
  it('tidies spaces and line breaks into one line', () => {
    expect(cleanMemoryText('  my land \n floods\tevery July  ')).toBe('my land floods every July');
  });

  it('keeps Bangla text', () => {
    expect(cleanMemoryText('আমার জমিতে প্রতি জুলাইয়ে বন্যা হয়')).toBe('আমার জমিতে প্রতি জুলাইয়ে বন্যা হয়');
  });

  it('refuses text that is too short, too long, empty or not a string', () => {
    expect(cleanMemoryText('ab')).toBeNull();
    expect(cleanMemoryText('   ')).toBeNull();
    expect(cleanMemoryText('a'.repeat(MEMORY_TEXT_MAX + 1))).toBeNull();
    expect(cleanMemoryText(123)).toBeNull();
    expect(cleanMemoryText(null)).toBeNull();
  });

  it('accepts exactly the limits', () => {
    expect(cleanMemoryText('abc')).toBe('abc');
    expect(cleanMemoryText('a'.repeat(MEMORY_TEXT_MAX))).toHaveLength(MEMORY_TEXT_MAX);
  });
});

describe('cleanMemoryInput', () => {
  it('accepts every category', () => {
    for (const category of MEMORY_CATEGORIES) {
      expect(cleanMemoryInput({ text: 'I use a shallow tube well', category })).toEqual({
        text: 'I use a shallow tube well',
        category,
      });
    }
  });

  it('refuses an unknown category, a missing text and non-objects', () => {
    expect(cleanMemoryInput({ text: 'I use a shallow tube well', category: 'secret' })).toBeNull();
    expect(cleanMemoryInput({ category: 'water' })).toBeNull();
    expect(cleanMemoryInput(null)).toBeNull();
    expect(cleanMemoryInput('text')).toBeNull();
  });

  it('knows its categories', () => {
    expect(isMemoryCategory('farm')).toBe(true);
    expect(isMemoryCategory('Farm')).toBe(false);
    expect(isMemoryCategory(undefined)).toBe(false);
  });
});

describe('toIsoTime', () => {
  it('reads ISO strings, Dates, Timestamp-like objects and seconds', () => {
    expect(toIsoTime('2026-11-28T10:00:00Z')).toBe('2026-11-28T10:00:00.000Z');
    expect(toIsoTime(new Date('2026-11-28T10:00:00Z'))).toBe('2026-11-28T10:00:00.000Z');
    expect(toIsoTime({ toDate: () => new Date('2026-11-28T10:00:00Z') })).toBe('2026-11-28T10:00:00.000Z');
    expect(toIsoTime({ seconds: 1795860000, nanoseconds: 500_000_000 })).toBe(new Date(1795860000500).toISOString());
  });

  it('is null for anything else', () => {
    expect(toIsoTime(null)).toBeNull();
    expect(toIsoTime('not a time')).toBeNull();
    expect(toIsoTime({})).toBeNull();
    expect(toIsoTime({ toDate: () => 'x' })).toBeNull();
    expect(toIsoTime({ toDate: () => { throw new Error('boom'); } })).toBeNull();
  });
});

describe('parseMemoryFact', () => {
  const base = {
    text: 'My land floods every July',
    category: 'farm',
    source: 'farmer_said',
    createdAt: { toDate: () => new Date('2026-11-01T00:00:00Z') },
    updatedAt: '2026-11-02T00:00:00Z',
    active: true,
  };

  it('rebuilds a good fact', () => {
    expect(parseMemoryFact('f1', base)).toEqual({
      id: 'f1',
      text: 'My land floods every July',
      category: 'farm',
      source: 'farmer_said',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
      active: true,
    });
  });

  it('keeps a fact whose server time is still pending, with empty times', () => {
    const fact = parseMemoryFact('f1', { ...base, createdAt: null, updatedAt: null });
    expect(fact?.createdAt).toBe('');
    expect(fact?.updatedAt).toBe('');
  });

  it('refuses a bad id, bad shape or unknown values', () => {
    expect(parseMemoryFact('bad id!', base)).toBeNull();
    expect(parseMemoryFact('f1', null)).toBeNull();
    expect(parseMemoryFact('f1', { ...base, text: 'x' })).toBeNull();
    expect(parseMemoryFact('f1', { ...base, category: 'nope' })).toBeNull();
    expect(parseMemoryFact('f1', { ...base, source: 'ai' })).toBeNull();
    expect(parseMemoryFact('f1', { ...base, active: 'yes' })).toBeNull();
  });
});

describe('sortMemoryFacts', () => {
  it('puts the newest first and does not change the input', () => {
    const input = [
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'c', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' },
      { id: 'b', createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' },
    ];
    expect(sortMemoryFacts(input).map((f) => f.id)).toEqual(['c', 'b', 'a']);
    expect(input.map((f) => f.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('write payloads', () => {
  it('a new fact is farmer_said, active, and carries the stamp twice', () => {
    const stamp = Symbol('server-time');
    const data = newMemoryFactData({ text: 'I sell at the Ishwardi hat', category: 'money' }, stamp);
    expect(data).toEqual({
      text: 'I sell at the Ishwardi hat',
      category: 'money',
      source: 'farmer_said',
      createdAt: stamp,
      updatedAt: stamp,
      active: true,
    });
  });

  it('a text edit marks the fact as edited and never touches createdAt', () => {
    const data = memoryTextChange('New text', 'T');
    expect(data).toEqual({ text: 'New text', source: 'farmer_edited', updatedAt: 'T' });
    expect('createdAt' in data).toBe(false);
  });
});

describe('ids and counts', () => {
  it('accepts the ids the rules accept', () => {
    expect(isValidDocId('abc_DEF-123')).toBe(true);
    expect(isValidDocId('a'.repeat(128))).toBe(true);
    expect(isValidDocId('a'.repeat(129))).toBe(false);
    expect(isValidDocId('')).toBe(false);
    expect(isValidDocId('a/b')).toBe(false);
    expect(isValidDocId(5)).toBe(false);
  });

  it('checks the message counter', () => {
    expect(isValidMessageCount(0)).toBe(true);
    expect(isValidMessageCount(12)).toBe(true);
    expect(isValidMessageCount(-1)).toBe(false);
    expect(isValidMessageCount(1.5)).toBe(false);
    expect(isValidMessageCount('3')).toBe(false);
  });
});

describe('thread fields', () => {
  it('cuts a title to one line of at most 80 characters', () => {
    expect(cleanThreadTitle('  A\nB  ')).toBe('A B');
    expect(cleanThreadTitle('x'.repeat(200))).toHaveLength(THREAD_TITLE_MAX);
    expect(cleanThreadTitle(undefined)).toBe('');
  });

  it('keeps summary line breaks, collapses blank lines and cuts at 2000', () => {
    expect(cleanThreadSummary('line one\n\n\nline two  ')).toBe('line one\nline two');
    expect(cleanThreadSummary('y'.repeat(5000))).toHaveLength(THREAD_SUMMARY_MAX);
    expect(cleanThreadSummary(42)).toBe('');
  });

  it('tidyLine returns an empty string for non-strings', () => {
    expect(tidyLine(null)).toBe('');
    expect(tidyLine('a\u0000b')).toBe('a b');
  });
});

describe('cleanToolCalls', () => {
  it('keeps good calls and drops bad ones', () => {
    expect(
      cleanToolCalls([
        { name: 'add_cost', status: 'proposed' },
        { name: 'add_cost', status: 'weird' },
        { name: '', status: 'done' },
        { name: 'x'.repeat(61), status: 'done' },
        null,
        'text',
        { name: 'set_reminder', status: 'declined', extra: 1 },
      ])
    ).toEqual([
      { name: 'add_cost', status: 'proposed' },
      { name: 'set_reminder', status: 'declined' },
    ]);
  });

  it('keeps at most 10 and is empty for non-lists', () => {
    const many = Array.from({ length: 15 }, () => ({ name: 't', status: 'done' }));
    expect(cleanToolCalls(many)).toHaveLength(TOOL_CALLS_MAX);
    expect(cleanToolCalls('nope')).toEqual([]);
    expect(cleanToolCalls(undefined)).toEqual([]);
  });
});

describe('cleanMessageInput', () => {
  it('accepts a user text message and keeps its line breaks', () => {
    expect(cleanMessageInput({ role: 'user', text: ' Can I spray today?\nIt looks cloudy. ', channel: 'text' })).toEqual({
      role: 'user',
      text: 'Can I spray today?\nIt looks cloudy.',
      channel: 'text',
    });
  });

  it('keeps tool calls when present', () => {
    expect(
      cleanMessageInput({
        role: 'assistant',
        text: 'Shall I add 900 taka?',
        channel: 'voice',
        toolCalls: [{ name: 'add_cost', status: 'proposed' }],
      })
    ).toEqual({
      role: 'assistant',
      text: 'Shall I add 900 taka?',
      channel: 'voice',
      toolCalls: [{ name: 'add_cost', status: 'proposed' }],
    });
  });

  it('refuses an unknown role or channel, empty text, long text and non-objects', () => {
    expect(cleanMessageInput({ role: 'system', text: 'x', channel: 'text' })).toBeNull();
    expect(cleanMessageInput({ role: 'user', text: 'x', channel: 'sms' })).toBeNull();
    expect(cleanMessageInput({ role: 'user', text: '   ', channel: 'text' })).toBeNull();
    expect(cleanMessageInput({ role: 'user', text: 'a'.repeat(MESSAGE_TEXT_MAX + 1), channel: 'text' })).toBeNull();
    expect(cleanMessageInput({ role: 'user', text: 5, channel: 'text' })).toBeNull();
    expect(cleanMessageInput(null)).toBeNull();
  });

  it('accepts exactly 4000 characters', () => {
    expect(cleanMessageInput({ role: 'user', text: 'a'.repeat(MESSAGE_TEXT_MAX), channel: 'live' })?.text).toHaveLength(
      MESSAGE_TEXT_MAX
    );
  });
});

describe('firestore.rules agree with these limits', () => {
  const rules = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8');
  const list = (items: readonly string[]) => `[${items.map((i) => `'${i}'`).join(', ')}]`;

  it('has balanced braces, parentheses and brackets', () => {
    for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
      expect(rules.split(open).length).toBe(rules.split(close).length);
    }
  });

  it('uses the same text limits, categories, roles, channels and tool statuses', () => {
    expect(rules).toContain(`isStr(incoming().text, ${MEMORY_TEXT_MIN}, ${MEMORY_TEXT_MAX})`);
    expect(rules).toContain(`incoming().category in ${list(MEMORY_CATEGORIES)}`);
    expect(rules).toContain(`isStr(incoming().title, 0, ${THREAD_TITLE_MAX})`);
    expect(rules).toContain(`isStr(incoming().summary, 0, ${THREAD_SUMMARY_MAX})`);
    expect(rules).toContain(`isStr(incoming().text, 1, ${MESSAGE_TEXT_MAX})`);
    expect(rules).toContain(`incoming().role in ${list(MESSAGE_ROLES)}`);
    expect(rules).toContain(`incoming().channel in ${list(MESSAGE_CHANNELS)}`);
    expect(rules).toContain(`isStr(tc.name, 1, ${TOOL_NAME_MAX})`);
    expect(rules).toContain(`tc.status in ${list(TOOL_CALL_STATUSES)}`);
    expect(rules).toContain(`tcs.size() <= ${TOOL_CALLS_MAX}`);
    // One check per allowed place.
    for (let i = 0; i < TOOL_CALLS_MAX; i += 1) expect(rules).toContain(`isToolCallAt(tcs, ${i})`);
    expect(rules).not.toContain(`isToolCallAt(tcs, ${TOOL_CALLS_MAX})`);
  });
});
