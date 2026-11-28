import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({
  ensureAiSession: async () => 'token',
  getAppCheckHeader: async () => ({}),
}));

import {
  ASK_ATTACHMENT_MAX,
  ASK_BODY_MAX_BYTES,
  ASK_HISTORY_MAX_TURNS,
  ASK_HISTORY_TEXT_MAX,
  ASK_MESSAGE_MAX,
  AssistantError,
  assistantErrorMessage,
  buildAssistantRequest,
  cleanToday,
  isAssistantAbort,
  mapAssistantHttpError,
  parseAssistantResponse,
} from './assistant';
import { ASK_HEADING, ASSISTANT_NAME, SOURCE_LABELS } from '../constants/assistant';
import { isSafetyBlockError, safetyBlockMessage } from '../utils/safetyBlock';

const base = { message: 'আলুর দাম কত?', lang: 'bn' as const, channel: 'text' as const };

describe('constants', () => {
  it('names the assistant and labels every source in both languages', () => {
    expect(ASSISTANT_NAME).toEqual({ bn: 'কৃষি সাথী', en: 'Krishi Sathi' });
    expect(Object.keys(SOURCE_LABELS).sort()).toEqual(
      ['ai_estimate', 'app_data', 'farmer_records', 'govt_bulletin', 'rules', 'weather_forecast']
    );
    expect(SOURCE_LABELS.rules).toEqual({ bn: 'নিয়ম অনুযায়ী', en: 'From the rules' });
    expect(SOURCE_LABELS.govt_bulletin.bn).toBe('সরকারি বাজারদর');
  });

  it('keeps the Home heading in one place, built on the name', () => {
    expect(ASK_HEADING).toEqual({ bn: 'কৃষি সাথীকে জিজ্ঞাসা করুন', en: 'Ask Krishi Sathi' });
    expect(ASK_HEADING.bn.startsWith(ASSISTANT_NAME.bn)).toBe(true);
    expect(ASK_HEADING.en.endsWith(ASSISTANT_NAME.en)).toBe(true);
  });
});

describe('buildAssistantRequest', () => {
  it('trims the message and cuts it to 2000 characters', () => {
    expect(buildAssistantRequest({ ...base, message: '  hello  ' }).message).toBe('hello');
    expect(buildAssistantRequest({ ...base, message: 'x'.repeat(5000) }).message).toHaveLength(ASK_MESSAGE_MAX);
  });

  it('refuses an empty message with an AssistantError', () => {
    expect(() => buildAssistantRequest({ ...base, message: '   ' })).toThrow(AssistantError);
  });

  it('keeps only the last 12 history turns, drops empty ones and cuts long ones', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      text: `t${i}`,
    }));
    history.splice(5, 0, { role: 'user', text: '   ' });
    const out = buildAssistantRequest({ ...base, history });
    expect(out.history).toHaveLength(ASK_HISTORY_MAX_TURNS);
    expect(out.history![11].text).toBe('t19');
    expect(out.history![0].text).toBe('t8');

    const long = buildAssistantRequest({ ...base, history: [{ role: 'user', text: 'y'.repeat(9000) }] });
    expect(long.history![0].text).toHaveLength(ASK_HISTORY_TEXT_MAX);
  });

  it('drops the oldest turns so the body stays under 32 KB (Bangla is 3 bytes a letter)', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      text: `${i}`.padEnd(4000, 'ক'),
    }));
    const out = buildAssistantRequest({ ...base, history });
    expect(new TextEncoder().encode(JSON.stringify(out)).length).toBeLessThanOrEqual(ASK_BODY_MAX_BYTES);
    expect(out.history!.length).toBeLessThan(12);
    // The newest turn always survives.
    expect(out.history![out.history!.length - 1].text.startsWith('11')).toBe(true);
  });

  it('cuts the attachment, ignores a bad location and an unknown channel', () => {
    const out = buildAssistantRequest({
      ...base,
      channel: 'weird' as never,
      location: { lat: 999, lon: 90 },
      attachment: { kind: 'diagnosis', summary: 'z'.repeat(8000) },
    });
    expect(out.channel).toBe('text');
    expect(out.location).toBeUndefined();
    expect(out.attachment!.summary).toHaveLength(ASK_ATTACHMENT_MAX);
    expect(buildAssistantRequest({ ...base, location: { lat: 23.81, lon: 90.41 } }).location).toEqual({ lat: 23.81, lon: 90.41 });
    expect(buildAssistantRequest({ ...base, attachment: { kind: 'diagnosis', summary: '  ' } }).attachment).toBeUndefined();
  });

  it('carries today\'s reading, keeping only known keys and finite numbers', () => {
    const out = buildAssistantRequest({
      ...base,
      today: {
        readingAt: '2026-11-29T05:00:00Z',
        temp: 31.5,
        humidity: 70,
        windSpeed: Infinity,
        rainChanceToday: NaN,
        rainChanceNext12h: 40,
        soilMoisture: 0.25,
        verdict: 'go',
      } as never,
    });
    expect(out.today).toEqual({
      readingAt: '2026-11-29T05:00:00.000Z',
      temp: 31.5,
      humidity: 70,
      rainChanceNext12h: 40,
      soilMoisture: 0.25,
    });
  });

  it('leaves the reading out when it has no usable temperature or time', () => {
    expect('today' in buildAssistantRequest(base)).toBe(false);
    expect(cleanToday({ readingAt: '2026-11-29T05:00:00Z', temp: NaN })).toBeUndefined();
    expect(cleanToday({ readingAt: 'not a time', temp: 20 })).toBeUndefined();
    expect(cleanToday({ temp: 20 })).toBeUndefined();
    expect(cleanToday('hot')).toBeUndefined();
    expect('today' in buildAssistantRequest({ ...base, today: { readingAt: 'x', temp: 20 } })).toBe(false);
  });

  it('leaves out history when there is none', () => {
    expect('history' in buildAssistantRequest(base)).toBe(false);
  });
});

describe('mapAssistantHttpError', () => {
  it('maps the safety refusal to blocked, with the app\'s safety message and its code', () => {
    const e = mapAssistantHttpError(400, { error: 'This request was blocked by our safety policy.', code: 'SAFETY_BLOCK' }, 'bn');
    expect(e.kind).toBe('blocked');
    expect(e.message).toBe(safetyBlockMessage('bn'));
    expect(mapAssistantHttpError(400, { code: 'SAFETY_BLOCK' }, 'en').message).toBe(safetyBlockMessage('en'));
    // The crop doctor recognises it the way it did before the assistant.
    expect(isSafetyBlockError(e)).toBe(true);
    expect(isSafetyBlockError(mapAssistantHttpError(400, null, 'bn'))).toBe(false);
  });
  it('maps a 429 with a limit field to limit', () => {
    expect(mapAssistantHttpError(429, { error: 'x', limit: 20 }, 'bn').kind).toBe('limit');
  });
  it('maps the global cap to capacity, whatever the status', () => {
    expect(mapAssistantHttpError(429, { code: 'daily_capacity' }, 'bn').kind).toBe('capacity');
    expect(mapAssistantHttpError(503, { code: 'daily_capacity' }, 'en').kind).toBe('capacity');
  });
  it('maps a 429 without a limit to capacity', () => {
    expect(mapAssistantHttpError(429, { error: 'slow down' }, 'bn').kind).toBe('capacity');
  });
  it('maps 401 and 403 to auth', () => {
    expect(mapAssistantHttpError(401, null, 'bn').kind).toBe('auth');
    expect(mapAssistantHttpError(403, {}, 'bn').kind).toBe('auth');
  });
  it('maps everything else to server and never echoes the server text', () => {
    const e = mapAssistantHttpError(502, { error: 'upstream key AIza123 failed' }, 'en');
    expect(e.kind).toBe('server');
    expect(e.message).not.toContain('AIza');
    expect(mapAssistantHttpError(400, null, 'bn').kind).toBe('server');
  });
  it('writes the message in the request language', () => {
    expect(mapAssistantHttpError(401, null, 'bn').message).toBe(assistantErrorMessage('auth', 'bn'));
    expect(mapAssistantHttpError(401, null, 'en').message).toBe(assistantErrorMessage('auth', 'en'));
    expect(assistantErrorMessage('offline', 'bn')).toMatch(/[ঀ-৿]/);
    expect(assistantErrorMessage('offline', 'en')).toMatch(/internet/i);
    expect(mapAssistantHttpError(429, { limit: 5 }, 'en')).toBeInstanceOf(AssistantError);
  });
});

describe('parseAssistantResponse', () => {
  it('accepts a good answer and drops unknown sources and bad tool calls', () => {
    const out = parseAssistantResponse({
      text: ' আজ স্প্রে করবেন না। ',
      toolCalls: [{ name: 'get_today_farm_actions', status: 'done' }, { name: '' }, null, { name: 'x', status: 'failed' }],
      sources: ['rules', 'rules', 'bogus', 'weather_forecast'],
      model: 'gemini-3.5-flash-lite',
    });
    expect(out).toEqual({
      text: 'আজ স্প্রে করবেন না।',
      toolCalls: [
        { name: 'get_today_farm_actions', status: 'done' },
        { name: 'x', status: 'failed' },
      ],
      sources: ['rules', 'weather_forecast'],
      model: 'gemini-3.5-flash-lite',
    });
  });
  it('refuses an answer with no text', () => {
    expect(parseAssistantResponse({ text: '  ' })).toBeNull();
    expect(parseAssistantResponse(null)).toBeNull();
    expect(parseAssistantResponse('hi')).toBeNull();
  });
  it('tolerates missing lists', () => {
    expect(parseAssistantResponse({ text: 'ok' })).toEqual({ text: 'ok', toolCalls: [], sources: [], model: '' });
  });
});

describe('isAssistantAbort', () => {
  it('recognises a cancelled request', () => {
    expect(isAssistantAbort(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isAssistantAbort(new Error('boom'))).toBe(false);
    expect(isAssistantAbort(null)).toBe(false);
  });
});
