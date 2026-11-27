import { describe, expect, it } from 'vitest';
import { cleanPricePerMon, slug } from '../../netlify/functions/_shared/area-model';
import { LOCAL_PRICE_CROPS, localPriceCrop, toPricePerMon } from './localPriceCrops';

describe('localPriceCrop', () => {
  it('maps the Market-screen crops to report slugs', () => {
    expect(localPriceCrop('potato')).toBe('potato');
    expect(localPriceCrop('onion')).toBe('onion');
    expect(localPriceCrop('paddy')).toBe('paddy');
    expect(localPriceCrop('betelLeaf')).toBe('betel_leaf');
  });

  it('returns null for an unknown or empty crop', () => {
    expect(localPriceCrop('wheat')).toBeNull();
    expect(localPriceCrop('')).toBeNull();
    expect(localPriceCrop(null)).toBeNull();
    expect(localPriceCrop('constructor')).toBeNull();
  });

  it('only produces slugs the server keeps as they are', () => {
    for (const value of Object.values(LOCAL_PRICE_CROPS)) expect(slug(value)).toBe(value);
  });
});

describe('toPricePerMon', () => {
  it('keeps a per-mon price', () => {
    expect(toPricePerMon(1200, 'mon')).toBe(1200);
  });

  it('turns a per-kg price into per-mon (x40)', () => {
    expect(toPricePerMon(25, 'kg')).toBe(1000);
    expect(toPricePerMon(22.5, 'kg')).toBe(900);
  });

  it('rejects empty, zero and negative input', () => {
    expect(toPricePerMon(null, 'mon')).toBeNull();
    expect(toPricePerMon(0, 'kg')).toBeNull();
    expect(toPricePerMon(-5, 'mon')).toBeNull();
    expect(toPricePerMon(Number.NaN, 'mon')).toBeNull();
  });

  it('gives a value the server accepts only inside 100 to 100000 per mon', () => {
    expect(cleanPricePerMon(toPricePerMon(25, 'kg'))).toBe(1000);
    expect(cleanPricePerMon(toPricePerMon(1, 'kg'))).toBeNull(); // 40 per mon: too low
    expect(cleanPricePerMon(toPricePerMon(5000, 'kg'))).toBeNull(); // 200000 per mon: too high
  });
});
