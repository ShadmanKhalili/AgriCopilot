import { describe, expect, it } from 'vitest';
import { isBulletinFromToday } from './marketPrices';

describe('isBulletinFromToday', () => {
  const now = new Date('2026-11-28T05:00:00Z'); // 11:00 in Dhaka, 28 Nov

  it('is true for a live bulletin fetched today in Dhaka', () => {
    expect(isBulletinFromToday({ fetchedAt: '2026-11-28T02:00:00Z', stale: false }, now)).toBe(true);
  });

  it('is false when the server marked it stale', () => {
    expect(isBulletinFromToday({ fetchedAt: '2026-11-28T02:00:00Z', stale: true }, now)).toBe(false);
  });

  it('is false for yesterday’s bulletin even if not flagged stale', () => {
    expect(isBulletinFromToday({ fetchedAt: '2026-11-27T05:00:00Z', stale: false }, now)).toBe(false);
  });

  it('uses the Dhaka date, not the UTC date', () => {
    // 19:00 UTC on 27 Nov is already 01:00 on 28 Nov in Dhaka.
    expect(isBulletinFromToday({ fetchedAt: '2026-11-27T19:00:00Z', stale: false }, now)).toBe(true);
  });

  it('is false for an unreadable date', () => {
    expect(isBulletinFromToday({ fetchedAt: 'garbage', stale: false }, now)).toBe(false);
  });
});
