import { describe, expect, it } from 'vitest';
import {
  cropDisplay,
  dayText,
  monText,
  plotNameFor,
  plotSizeText,
  profitView,
  recordTotals,
  takaText,
} from './farmRecordView';

describe('cropDisplay', () => {
  it('names a known crop in both languages', () => {
    expect(cropDisplay('paddy_boro', 'bn').name).toBe('বোরো ধান');
    expect(cropDisplay('paddy_boro', 'en').emoji).toBe('🌾');
  });
  it('shows an unknown key as typed with a sprout', () => {
    expect(cropDisplay('mystery', 'en')).toEqual({ name: 'mystery', emoji: '🌱' });
    expect(cropDisplay('toString', 'en').name).toBe('toString');
  });
});

describe('text helpers', () => {
  it('writes plot size in Bangla and English', () => {
    expect(plotSizeText({ landSize: 1.5, landUnit: 'bigha' }, 'bn')).toBe('১.৫ বিঘা');
    expect(plotSizeText({ landSize: 20, landUnit: 'decimal' }, 'en')).toBe('20 decimal');
  });
  it('groups taka with Indian grouping and Bangla digits', () => {
    expect(takaText(123456, 'bn')).toBe('৳১,২৩,৪৫৬');
    expect(takaText(-5000, 'en')).toBe('৳5,000');
  });
  it('writes mon', () => {
    expect(monText(12.5, 'bn')).toBe('১২.৫ মণ');
    expect(monText(3, 'en')).toBe('3 mon');
  });
  it('falls back for a missing date', () => {
    expect(dayText(undefined, 'en')).toBe('-');
    expect(dayText('nope', 'en', '')).toBe('');
    expect(dayText('2026-11-13', 'en')).toContain('2026');
  });
  it('finds a plot name, or nothing', () => {
    const plots = [{ id: 'a', name: 'Home field' }];
    expect(plotNameFor(plots, 'a')).toBe('Home field');
    expect(plotNameFor(plots, 'gone')).toBe('');
    expect(plotNameFor(plots, undefined)).toBe('');
  });
});

describe('profitView', () => {
  it('shows nothing until something is sold', () => {
    expect(profitView({ profit: null }, 'bn')).toEqual({ tone: null, word: '', amount: '', text: '' });
    expect(profitView({ profit: null, revenue: 0, costCount: 0 }, 'en').tone).toBeNull();
    expect(profitView({ profit: null, revenue: 0, costCount: 3 }, 'en').tone).toBeNull();
  });
  it('says profit or loss in words', () => {
    expect(profitView({ profit: 4000 }, 'en')).toEqual({ tone: 'profit', word: 'Profit', amount: '৳4,000', text: 'Profit ৳4,000' });
    expect(profitView({ profit: -2500 }, 'bn')).toEqual({ tone: 'loss', word: 'ক্ষতি', amount: '৳২,৫০০', text: 'ক্ষতি ৳২,৫০০' });
  });
  it('says income with no costs noted instead of calling it a profit', () => {
    expect(profitView({ profit: null, revenue: 16500, costCount: 0 }, 'en')).toEqual({
      tone: 'no_costs',
      word: 'Income',
      amount: '৳16,500',
      text: 'Income ৳16,500 — no costs noted yet',
    });
    expect(profitView({ profit: null, revenue: 16500, costCount: 0 }, 'bn').text).toBe('আয় ৳১৬,৫০০ — খরচ এখনো লেখা হয়নি');
  });
});

describe('recordTotals', () => {
  const t = (costTotal: number, revenue: number, soldMon: number, profit: number | null, costCount = 1) => ({
    costTotal,
    costCount,
    soldMon,
    revenue,
    profit,
    avgPricePerMon: null,
  });
  it('adds up seasons and counts profit only for sold seasons', () => {
    const out = recordTotals([
      { totals: t(1000, 3000, 3, 2000), harvestMon: 4 },
      { totals: t(500, 0, 0, null) },
    ]);
    expect(out).toEqual({
      costTotal: 1500,
      costCount: 2,
      revenue: 3000,
      soldMon: 3,
      harvestMon: 4,
      profit: 2000,
      incomeWithoutCosts: 0,
    });
  });
  it('has no profit when nothing is sold', () => {
    expect(recordTotals([{ totals: t(500, 0, 0, null) }]).profit).toBeNull();
    expect(recordTotals([]).costTotal).toBe(0);
  });
  it('does not turn a season without costs into profit', () => {
    const out = recordTotals([
      { totals: t(1000, 3000, 3, 2000) },
      { totals: t(0, 5000, 5, null, 0) },
    ]);
    expect(out.profit).toBe(2000);
    expect(out.revenue).toBe(8000);
    expect(out.incomeWithoutCosts).toBe(5000);
  });
  it('has no profit at all when every sold season lacks costs', () => {
    const out = recordTotals([{ totals: t(0, 5000, 5, null, 0) }]);
    expect(out.profit).toBeNull();
    expect(out.costCount).toBe(0);
    expect(out.incomeWithoutCosts).toBe(5000);
  });
});
