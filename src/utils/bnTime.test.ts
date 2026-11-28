import { describe, expect, it } from 'vitest';
import { clockLabel, clockParts, dayPartBn, timeLabel } from './bnTime';

describe('clockLabel', () => {
  it('reads Bangla hours with the part of the day and Bangla numerals', () => {
    expect(clockLabel(6, 0, true)).toBe('সকাল ৬টা');
    expect(clockLabel(12, 0, true)).toBe('দুপুর ১২টা');
    expect(clockLabel(15, 0, true)).toBe('বিকাল ৩টা');
    expect(clockLabel(18, 0, true)).toBe('সন্ধ্যা ৬টা');
    expect(clockLabel(21, 0, true)).toBe('রাত ৯টা');
    expect(clockLabel(0, 0, true)).toBe('রাত ১২টা');
  });

  it('shows minutes when they are not zero', () => {
    expect(clockLabel(10, 30, true)).toBe('সকাল ১০:৩০');
    expect(clockLabel(10, 30, false)).toBe('10:30 AM');
  });

  it('reads English as AM and PM', () => {
    expect(clockLabel(6, 0, false)).toBe('6 AM');
    expect(clockLabel(12, 0, false)).toBe('12 PM');
    expect(clockLabel(0, 0, false)).toBe('12 AM');
    expect(clockLabel(21, 0, false)).toBe('9 PM');
  });
});

describe('dayPartBn', () => {
  it('names the early morning separately', () => {
    expect(dayPartBn(5)).toBe('ভোর');
    expect(dayPartBn(23)).toBe('রাত');
  });
});

describe('clockParts', () => {
  it('reads a zoneless forecast time as written', () => {
    expect(clockParts('2026-11-28T06:00')).toEqual({ hour: 6, minute: 0 });
  });

  it('shows a UTC time in Bangladesh time', () => {
    expect(clockParts('2026-11-28T00:00:00Z')).toEqual({ hour: 6, minute: 0 });
    expect(clockParts('2026-11-28T20:30:00Z')).toEqual({ hour: 2, minute: 30 });
  });

  it('returns null for nothing or nonsense', () => {
    expect(clockParts(undefined)).toBeNull();
    expect(clockParts('not a time')).toBeNull();
    expect(timeLabel('', true)).toBeNull();
  });
});

describe('timeLabel', () => {
  it('combines the two', () => {
    expect(timeLabel('2026-11-28T15:00', true)).toBe('বিকাল ৩টা');
    expect(timeLabel('2026-11-28T15:00', false)).toBe('3 PM');
  });
});
