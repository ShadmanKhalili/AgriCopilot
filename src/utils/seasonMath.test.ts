import { describe, expect, it } from 'vitest';
import {
  EXPENSE_CATEGORIES,
  MAX_AMOUNT_BDT,
  MAX_LAND_SIZE,
  MAX_PRICE_PER_MON,
  MAX_YIELD_MON,
  NOTE_MAX,
  expenseTotalsByCategory,
  landInDecimals,
  normaliseExpenseInput,
  normaliseSeasonInput,
  planResult,
  sortExpenses,
  sortSeasons,
  totalExpenses,
} from './seasonMath';

const validSeason = {
  crop: 'paddy_boro',
  landSize: 2.36,
  landUnit: 'decimal' as const,
  expectedYieldMon: 12.34,
  expectedPricePerMon: 1234.6,
  plannedCost: 5000.4,
};

describe('normaliseSeasonInput', () => {
  it('accepts a valid plan and rounds the numbers', () => {
    expect(normaliseSeasonInput(validSeason)).toEqual({
      crop: 'paddy_boro',
      landSize: 2.4,
      landUnit: 'decimal',
      expectedYieldMon: 12.3,
      expectedPricePerMon: 1235,
      plannedCost: 5000,
    });
  });

  it('lower-cases and trims an uppercase crop key', () => {
    expect(normaliseSeasonInput({ ...validSeason, crop: '  PADDY ' })?.crop).toBe('paddy');
  });

  it('rejects crop keys with spaces or symbols', () => {
    expect(normaliseSeasonInput({ ...validSeason, crop: 'paddy boro' })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, crop: 'paddy!' })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, crop: 'paddy/boro' })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, crop: '' })).toBeNull();
  });

  it('rejects an unknown land unit', () => {
    expect(normaliseSeasonInput({ ...validSeason, landUnit: 'hectare' as never })).toBeNull();
  });

  it('rejects zero or negative land size', () => {
    expect(normaliseSeasonInput({ ...validSeason, landSize: 0 })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, landSize: -1 })).toBeNull();
  });

  it('rejects NaN numbers', () => {
    expect(normaliseSeasonInput({ ...validSeason, landSize: NaN })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, expectedYieldMon: NaN })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, expectedPricePerMon: NaN })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, plannedCost: NaN })).toBeNull();
  });

  it('rejects missing fields', () => {
    expect(normaliseSeasonInput({})).toBeNull();
  });

  it('accepts values exactly at the limits and rejects values above them', () => {
    expect(normaliseSeasonInput({ ...validSeason, landSize: MAX_LAND_SIZE })).not.toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, landSize: MAX_LAND_SIZE + 1 })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, expectedYieldMon: MAX_YIELD_MON + 1 })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, expectedPricePerMon: MAX_PRICE_PER_MON + 1 })).toBeNull();
    expect(normaliseSeasonInput({ ...validSeason, plannedCost: MAX_AMOUNT_BDT + 1 })).toBeNull();
  });
});

describe('normaliseExpenseInput', () => {
  const today = '2026-11-13';
  const good = { category: 'seeds' as const, amount: 500, note: '', date: '2026-11-01' };

  it('accepts a valid cost', () => {
    expect(normaliseExpenseInput(good, today)).toEqual({
      category: 'seeds',
      amount: 500,
      note: '',
      date: '2026-11-01',
    });
  });

  it('rejects an unknown category', () => {
    expect(normaliseExpenseInput({ ...good, category: 'bribes' as never }, today)).toBeNull();
  });

  it('rejects an amount of 0', () => {
    expect(normaliseExpenseInput({ ...good, amount: 0 }, today)).toBeNull();
  });

  it('rejects a negative amount', () => {
    expect(normaliseExpenseInput({ ...good, amount: -10 }, today)).toBeNull();
  });

  it('rejects an amount that rounds to 0', () => {
    expect(normaliseExpenseInput({ ...good, amount: 0.4 }, today)).toBeNull();
  });

  it('rounds a fractional amount to whole taka', () => {
    expect(normaliseExpenseInput({ ...good, amount: 499.6 }, today)?.amount).toBe(500);
  });

  it('rejects an amount above MAX_AMOUNT_BDT', () => {
    expect(normaliseExpenseInput({ ...good, amount: MAX_AMOUNT_BDT + 1 }, today)).toBeNull();
    expect(normaliseExpenseInput({ ...good, amount: MAX_AMOUNT_BDT }, today)?.amount).toBe(MAX_AMOUNT_BDT);
  });

  it('trims the note and cuts it to NOTE_MAX', () => {
    expect(normaliseExpenseInput({ ...good, note: '   urea bag   ' }, today)?.note).toBe('urea bag');
    const long = normaliseExpenseInput({ ...good, note: 'a'.repeat(NOTE_MAX + 50) }, today);
    expect(long?.note).toHaveLength(NOTE_MAX);
  });

  it('uses today when the date is missing', () => {
    expect(normaliseExpenseInput({ category: 'labor', amount: 100 }, today)?.date).toBe(today);
  });

  it('uses today when the date is malformed', () => {
    expect(normaliseExpenseInput({ ...good, date: '13/11/2026' }, today)?.date).toBe(today);
    expect(normaliseExpenseInput({ ...good, date: '2026-1-1' }, today)?.date).toBe(today);
  });
});

describe('totalExpenses', () => {
  it('sums the amounts', () => {
    expect(totalExpenses([{ amount: 100 }, { amount: 250 }, { amount: 50 }])).toBe(400);
  });

  it('is 0 for no expenses', () => {
    expect(totalExpenses([])).toBe(0);
  });

  it('ignores non-finite amounts', () => {
    expect(totalExpenses([{ amount: 100 }, { amount: NaN }])).toBe(100);
  });
});

describe('expenseTotalsByCategory', () => {
  it('totals per category, largest first, only categories present', () => {
    const result = expenseTotalsByCategory([
      { category: 'labor', amount: 300 },
      { category: 'seeds', amount: 100 },
      { category: 'seeds', amount: 250 },
      { category: 'fertilizer', amount: 50 },
    ]);
    expect(result).toEqual([
      { category: 'seeds', amount: 350 },
      { category: 'labor', amount: 300 },
      { category: 'fertilizer', amount: 50 },
    ]);
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.category === 'lease')).toBeUndefined();
    expect(EXPENSE_CATEGORIES).toContain('lease');
  });

  it('returns an empty list for no expenses', () => {
    expect(expenseTotalsByCategory([])).toEqual([]);
  });
});

describe('sortExpenses', () => {
  it('puts the newest date first and breaks ties with createdAt, newest first', () => {
    const list = [
      { id: 'a', date: '2026-10-01', createdAt: '2026-10-01T08:00:00Z' },
      { id: 'b', date: '2026-11-05', createdAt: '2026-11-05T08:00:00Z' },
      { id: 'c', date: '2026-11-05', createdAt: '2026-11-05T10:00:00Z' },
      { id: 'd', date: '2026-09-20', createdAt: '2026-09-20T08:00:00Z' },
    ];
    expect(sortExpenses(list).map((e) => e.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('does not mutate the input', () => {
    const list = [
      { date: '2026-01-01', createdAt: 'x' },
      { date: '2026-02-01', createdAt: 'y' },
    ];
    sortExpenses(list);
    expect(list[0].date).toBe('2026-01-01');
  });
});

describe('sortSeasons', () => {
  it('puts the most recently updated plan first', () => {
    const list = [
      { id: 'old', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'new', updatedAt: '2026-06-01T00:00:00Z' },
      { id: 'mid', updatedAt: '2026-03-01T00:00:00Z' },
    ];
    expect(sortSeasons(list).map((s) => s.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('landInDecimals', () => {
  it('converts each unit to decimals', () => {
    expect(landInDecimals(5, 'decimal')).toBe(5);
    expect(landInDecimals(2, 'bigha')).toBe(66);
    expect(landInDecimals(1, 'acre')).toBe(100);
    expect(landInDecimals(10, 'katha')).toBeCloseTo(16.5, 10);
  });
});

describe('planResult', () => {
  it('gives a profit when income beats cost', () => {
    expect(planResult(10000, 20, 800)).toEqual({
      income: 16000,
      profit: 6000,
      breakEvenPerMon: 500,
    });
  });

  it('gives a loss when cost beats income', () => {
    expect(planResult(20000, 20, 800)).toEqual({
      income: 16000,
      profit: -4000,
      breakEvenPerMon: 1000,
    });
  });

  it('has no break-even price with zero yield', () => {
    expect(planResult(5000, 0, 800)).toEqual({
      income: 0,
      profit: -5000,
      breakEvenPerMon: null,
    });
  });
});
