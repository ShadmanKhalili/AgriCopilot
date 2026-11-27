import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null } }));

import { buildBroadcast, expiryForDays, isExpired, type BroadcastInput } from './broadcasts';

// 2026-03-10 12:00 in Dhaka
const NOW = new Date('2026-03-10T06:00:00Z');

const input = (over: Partial<BroadcastInput> = {}): BroadcastInput => ({
  messageBn: 'ঝড়ের সতর্কতা',
  messageEn: 'Storm warning',
  district: 'Bogura',
  severity: 'warning',
  expiresDay: '2026-03-12',
  ...over,
});

const error = (over: Partial<BroadcastInput>, uid = 'admin1') => {
  const result = buildBroadcast(input(over), uid, NOW);
  return result.ok === false ? result.error : null;
};

describe('buildBroadcast', () => {
  it('builds exactly the 7 fields the rules allow', () => {
    const result = buildBroadcast(input(), 'admin1', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.broadcast).sort()).toEqual(
      ['createdAt', 'createdBy', 'district', 'expiresDay', 'messageBn', 'messageEn', 'severity'].sort()
    );
    expect(result.broadcast.createdBy).toBe('admin1');
    expect(result.broadcast.createdAt).toBe('2026-03-10T06:00:00.000Z');
    expect(result.broadcast.createdAt.length).toBeGreaterThanOrEqual(19);
    expect(result.broadcast.createdAt.length).toBeLessThanOrEqual(50);
  });

  it('trims the messages', () => {
    const result = buildBroadcast(input({ messageEn: '  Hello  ', messageBn: ' হ্যালো ' }), 'u', NOW);
    expect(result.ok && result.broadcast.messageEn).toBe('Hello');
    expect(result.ok && result.broadcast.messageBn).toBe('হ্যালো');
  });

  it('rejects empty or blank messages', () => {
    expect(error({ messageBn: '' })).toBe('message_bn_empty');
    expect(error({ messageEn: '   ' })).toBe('message_en_empty');
  });

  it('accepts 500 characters and rejects 501', () => {
    expect(error({ messageEn: 'a'.repeat(500) })).toBeNull();
    expect(error({ messageEn: 'a'.repeat(501) })).toBe('message_en_too_long');
    expect(error({ messageBn: 'ক'.repeat(501) })).toBe('message_bn_too_long');
  });

  it('turns a district name into a slug, or keeps all', () => {
    const named = buildBroadcast(input({ district: "Cox's Bazar" }), 'u', NOW);
    expect(named.ok && named.broadcast.district).toBe('cox_s_bazar');
    const all = buildBroadcast(input({ district: 'ALL' }), 'u', NOW);
    expect(all.ok && all.broadcast.district).toBe('all');
    const plain = buildBroadcast(input({ district: 'Bogura' }), 'u', NOW);
    expect(plain.ok && plain.broadcast.district).toBe('bogura');
  });

  it('rejects a district with nothing usable in it', () => {
    expect(error({ district: '' })).toBe('district_invalid');
    expect(error({ district: 'বগুড়া' })).toBe('district_invalid');
  });

  it('rejects an unknown severity', () => {
    expect(error({ severity: 'critical' as never })).toBe('severity_invalid');
    expect(error({ severity: 'info' })).toBeNull();
  });

  it('allows today up to 30 days ahead (Dhaka date)', () => {
    expect(error({ expiresDay: '2026-03-10' })).toBeNull();
    expect(error({ expiresDay: '2026-04-09' })).toBeNull();
    expect(error({ expiresDay: '2026-04-10' })).toBe('expiry_out_of_range');
    expect(error({ expiresDay: '2026-03-09' })).toBe('expiry_out_of_range');
  });

  it('uses the Dhaka day, not the UTC day', () => {
    // 20:00 UTC on the 10th is already the 11th in Dhaka.
    const late = buildBroadcast(input({ expiresDay: '2026-03-10' }), 'u', new Date('2026-03-10T20:00:00Z'));
    expect(late.ok).toBe(false);
  });

  it('rejects malformed days', () => {
    expect(error({ expiresDay: '' })).toBe('expiry_invalid');
    expect(error({ expiresDay: '12/03/2026' })).toBe('expiry_invalid');
    expect(error({ expiresDay: '2026-02-30' })).toBe('expiry_invalid');
  });

  it('refuses without a signed-in user', () => {
    expect(error({}, '')).toBe('signed_out');
  });
});

describe('expiryForDays', () => {
  it('counts today as day 1 and caps at 30', () => {
    expect(expiryForDays(1, NOW)).toBe('2026-03-10');
    expect(expiryForDays(3, NOW)).toBe('2026-03-12');
    expect(expiryForDays(500, NOW)).toBe('2026-04-08');
    expect(expiryForDays(0, NOW)).toBe('2026-03-10');
  });

  it('always passes buildBroadcast', () => {
    for (const days of [1, 7, 30]) {
      expect(error({ expiresDay: expiryForDays(days, NOW) })).toBeNull();
    }
  });
});

describe('isExpired', () => {
  it('is false on the last day and true the day after', () => {
    expect(isExpired({ expiresDay: '2026-03-10' }, NOW)).toBe(false);
    expect(isExpired({ expiresDay: '2026-03-09' }, NOW)).toBe(true);
  });
});
