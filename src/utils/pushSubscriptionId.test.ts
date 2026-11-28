import { describe, it, expect } from 'vitest';
import { pickSubscriptionId, pushSlotIds, isPushSlotId, PUSH_SLOTS } from './pushSubscriptionId';

const uid = 'abc123';

describe('pickSubscriptionId', () => {
  it('uses only ids the Firestore rule accepts (<uid>_0 .. <uid>_4)', () => {
    expect(pushSlotIds(uid)).toEqual(['abc123_0', 'abc123_1', 'abc123_2', 'abc123_3', 'abc123_4']);
    expect(isPushSlotId(uid, 'abc123_4')).toBe(true);
    expect(isPushSlotId(uid, 'abc123_5')).toBe(false);
    expect(isPushSlotId(uid, 'abc123')).toBe(false);
  });

  it('takes the first slot for a first phone', () => {
    expect(pickSubscriptionId(uid, 'https://fcm.googleapis.com/a', [])).toBe('abc123_0');
  });

  it('reuses the slot this phone already has, so saving again overwrites', () => {
    const saved = [
      { id: 'abc123_0', endpoint: 'https://fcm.googleapis.com/other' },
      { id: 'abc123_1', endpoint: 'https://fcm.googleapis.com/a' },
    ];
    expect(pickSubscriptionId(uid, 'https://fcm.googleapis.com/a', saved)).toBe('abc123_1');
  });

  it('takes the first free slot for a new phone', () => {
    const saved = [
      { id: 'abc123_0', endpoint: 'x' },
      { id: 'abc123_2', endpoint: 'y' },
    ];
    expect(pickSubscriptionId(uid, 'https://fcm.googleapis.com/new', saved)).toBe('abc123_1');
  });

  it('ignores old hash ids that are not slots', () => {
    const saved = [{ id: 'a'.repeat(40), endpoint: 'https://fcm.googleapis.com/a' }];
    expect(pickSubscriptionId(uid, 'https://fcm.googleapis.com/a', saved)).toBe('abc123_0');
  });

  it('never leaves the five slots, even when all are taken', () => {
    const saved = pushSlotIds(uid).map((id, i) => ({ id, endpoint: `https://fcm.googleapis.com/${i}` }));
    const id = pickSubscriptionId(uid, 'https://fcm.googleapis.com/sixth', saved);
    expect(pushSlotIds(uid)).toContain(id);
    expect(pushSlotIds(uid)).toHaveLength(PUSH_SLOTS);
  });
});
