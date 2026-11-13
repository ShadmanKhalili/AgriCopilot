import { describe, it, expect } from 'vitest';
import { cropKeyForProduce, priceEstimateRange, formatEstimate, estimateLine } from './gradePrice';

describe('cropKeyForProduce', () => {
  it('maps chili to the bulletin crop', () => {
    expect(cropKeyForProduce('chili')).toBe('chili');
  });
  it('returns null for products the bulletin does not carry', () => {
    for (const k of ['tomato', 'brinjal', 'dryFish', 'shrimp', 'salt', 'betelNut', 'mango', 'banana', 'coconut']) {
      expect(cropKeyForProduce(k)).toBeNull();
    }
    expect(cropKeyForProduce('')).toBeNull();
    expect(cropKeyForProduce(undefined)).toBeNull();
  });
});

describe('priceEstimateRange', () => {
  it('uses the range when given, ordered', () => {
    expect(priceEstimateRange({ estimatedPriceBdt: 50, estimatedPriceLowBdt: 60, estimatedPriceHighBdt: 40 }))
      .toEqual({ low: 40, high: 60, isRange: true });
  });
  it('falls back to the single figure', () => {
    expect(priceEstimateRange({ estimatedPriceBdt: 45.4 })).toEqual({ low: 45, high: 45, isRange: false });
  });
  it('returns null for missing, zero or bad numbers', () => {
    expect(priceEstimateRange({})).toBeNull();
    expect(priceEstimateRange({ estimatedPriceBdt: 0 })).toBeNull();
    expect(priceEstimateRange({ estimatedPriceBdt: 'x' })).toBeNull();
    expect(priceEstimateRange({ estimatedPriceBdt: NaN })).toBeNull();
  });
});

describe('formatting', () => {
  it('formats in Bangla numerals', () => {
    expect(formatEstimate({ low: 40, high: 60, isRange: true }, 'bn')).toBe('৳৪০–৬০');
  });
  it('labels the estimate', () => {
    expect(estimateLine({ low: 40, high: 60, isRange: true }, 'en')).toBe('৳40–60/kg (AI estimate)');
    expect(estimateLine({ low: 40, high: 40, isRange: false }, 'bn')).toContain('এআই-এর অনুমান');
    expect(estimateLine(null, 'en')).toBe('Price: no estimate');
  });
});
