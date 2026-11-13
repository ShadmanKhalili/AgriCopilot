import { describe, expect, it } from 'vitest';
import type { BulletinPrice, OfficialBulletin } from '../services/marketPrices';
import {
  bulletinDateLabel,
  bulletinLinkForCrop,
  cropPriceFromBulletin,
  perKgToPerMon,
} from './marketPriceView';

const price = (id: string, low: number, high: number): BulletinPrice => ({
  id,
  label: id,
  name: id,
  low,
  high,
  changePct: null,
  direction: 'flat',
});

const bulletin = (overrides: Partial<OfficialBulletin> = {}): OfficialBulletin => ({
  source: 'DAM',
  sourceUrl: 'https://example.invalid/dam',
  fetchedAt: '2026-11-13T04:00:00Z',
  stale: false,
  itemCount: 2,
  prices: [price('faridpur_onion', 40, 50), price('dinajpur_rice', 52, 58)],
  missing: [],
  ...overrides,
});

describe('bulletinLinkForCrop', () => {
  it('maps chili to the pabna chili line', () => {
    expect(bulletinLinkForCrop('chili')).toEqual({ bulletinId: 'pabna_chili', related: false });
  });

  it('maps onion to the faridpur onion line', () => {
    expect(bulletinLinkForCrop('onion')).toEqual({ bulletinId: 'faridpur_onion', related: false });
  });

  it('maps paddy and paddy_boro to rice as a related product', () => {
    expect(bulletinLinkForCrop('paddy')).toEqual({ bulletinId: 'dinajpur_rice', related: true });
    expect(bulletinLinkForCrop('paddy_boro')).toEqual({ bulletinId: 'dinajpur_rice', related: true });
  });

  it('returns null for tomato, which the bulletin does not carry', () => {
    expect(bulletinLinkForCrop('tomato')).toBeNull();
  });

  it('returns null for null or undefined', () => {
    expect(bulletinLinkForCrop(null)).toBeNull();
    expect(bulletinLinkForCrop(undefined)).toBeNull();
  });
});

describe('cropPriceFromBulletin', () => {
  it('is unavailable when there is no bulletin', () => {
    expect(cropPriceFromBulletin(null, 'onion')).toEqual({ kind: 'unavailable' });
  });

  it('is not_listed for tomato', () => {
    expect(cropPriceFromBulletin(bulletin(), 'tomato')).toEqual({ kind: 'not_listed' });
  });

  it('is official for onion when the bulletin has the onion price', () => {
    const state = cropPriceFromBulletin(bulletin(), 'onion');
    expect(state).toEqual({
      kind: 'official',
      price: price('faridpur_onion', 40, 50),
      related: false,
      fetchedAt: '2026-11-13T04:00:00Z',
      stale: false,
    });
  });

  it('is related for paddy with the rice price', () => {
    const state = cropPriceFromBulletin(bulletin(), 'paddy');
    expect(state).toEqual({
      kind: 'related',
      price: price('dinajpur_rice', 52, 58),
      related: true,
      fetchedAt: '2026-11-13T04:00:00Z',
      stale: false,
    });
  });

  it('is not_listed for onion when the bulletin lacks that id', () => {
    const state = cropPriceFromBulletin(bulletin({ prices: [price('dinajpur_rice', 52, 58)] }), 'onion');
    expect(state).toEqual({ kind: 'not_listed' });
  });

  it('passes the stale flag and fetchedAt through', () => {
    const stale = bulletin({ stale: true, fetchedAt: '2026-11-10T04:00:00Z' });
    const state = cropPriceFromBulletin(stale, 'onion');
    expect(state.kind).toBe('official');
    if (state.kind === 'official' || state.kind === 'related') {
      expect(state.stale).toBe(true);
      expect(state.fetchedAt).toBe('2026-11-10T04:00:00Z');
    }
  });
});

describe('perKgToPerMon', () => {
  it('converts 50 taka per kg to 2000 per mon (40 kg)', () => {
    expect(perKgToPerMon(50)).toBe(2000);
  });
});

describe('bulletinDateLabel', () => {
  it('returns an empty string for an invalid date', () => {
    expect(bulletinDateLabel('not a date', 'en')).toBe('');
    expect(bulletinDateLabel('', 'bn')).toBe('');
  });

  it('gives the Dhaka calendar day in English', () => {
    // 20:30 UTC on 12 Nov is already 02:30 on 13 Nov in Dhaka (UTC+6).
    expect(bulletinDateLabel('2026-11-12T20:30:00Z', 'en')).toBe('13 Nov');
  });

  it('gives a non-empty Bangla label', () => {
    expect(bulletinDateLabel('2026-11-12T20:30:00Z', 'bn')).not.toBe('');
  });
});
