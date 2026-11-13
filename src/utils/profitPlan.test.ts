import { describe, expect, it } from 'vitest';
import { CROP_BENCHMARKS, COST_ITEM_KEYS } from '../data/cropBenchmarks';
import {
  benchmarkKeyForMainCrop,
  costItemsForTotal,
  formatTaka,
  initialBenchmarkKey,
  isBenchmarkKey,
  landLabel,
  mainCropForBenchmark,
  parseNumberInput,
  typicalCostItems,
} from './profitPlan';

const sumItems = (items: Record<string, number>) => Object.values(items).reduce((a, b) => a + b, 0);

describe('benchmarkKeyForMainCrop', () => {
  it('maps paddy to boro and other crops to their own keys', () => {
    expect(benchmarkKeyForMainCrop('paddy')).toBe('paddy_boro');
    for (const id of ['chili', 'potato', 'tomato', 'onion', 'brinjal', 'maize']) {
      expect(benchmarkKeyForMainCrop(id)).toBe(id);
    }
  });
  it('falls back to boro paddy for crops without typical figures', () => {
    expect(benchmarkKeyForMainCrop('mustard')).toBe('paddy_boro');
    expect(benchmarkKeyForMainCrop('jute')).toBe('paddy_boro');
    expect(benchmarkKeyForMainCrop(null)).toBe('paddy_boro');
    expect(benchmarkKeyForMainCrop('')).toBe('paddy_boro');
  });
  it('accepts a calculator key as is', () => {
    expect(benchmarkKeyForMainCrop('paddy_aman')).toBe('paddy_aman');
  });
  it('only returns real benchmark keys', () => {
    for (const id of ['paddy', 'chili', 'jute', 'x', null]) {
      expect(isBenchmarkKey(benchmarkKeyForMainCrop(id))).toBe(true);
    }
  });
});

describe('initialBenchmarkKey', () => {
  it('lets the main crop win over the shell default', () => {
    expect(initialBenchmarkKey('paddy_boro', 'potato')).toBe('potato');
    expect(initialBenchmarkKey(undefined, 'onion')).toBe('onion');
  });
  it('keeps a crop chosen by another screen', () => {
    expect(initialBenchmarkKey('tomato', 'potato')).toBe('tomato');
  });
  it('ignores unknown crops', () => {
    expect(initialBenchmarkKey('wheat', 'chili')).toBe('chili');
    expect(initialBenchmarkKey('wheat', null)).toBe('paddy_boro');
  });
});

describe('mainCropForBenchmark', () => {
  it('maps both paddy seasons back to paddy', () => {
    expect(mainCropForBenchmark('paddy_boro')).toBe('paddy');
    expect(mainCropForBenchmark('paddy_aman')).toBe('paddy');
    expect(mainCropForBenchmark('onion')).toBe('onion');
  });
});

describe('costItemsForTotal', () => {
  const boro = CROP_BENCHMARKS.paddy_boro;

  it('adds up to the total exactly', () => {
    for (const total of [0, 1, 999, 25_700, 123_457]) {
      const items = costItemsForTotal(boro, 1.5, total);
      expect(sumItems(items)).toBe(total);
      expect(items.lease).toBe(0);
      for (const key of COST_ITEM_KEYS) expect(items[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the typical items back for the typical total', () => {
    const typical = typicalCostItems(boro, 2);
    expect(costItemsForTotal(boro, 2, sumItems(typical))).toEqual(typical);
  });

  it('keeps the typical proportions', () => {
    const items = costItemsForTotal(boro, 1, 2 * sumItems(typicalCostItems(boro, 1)));
    expect(items.labor).toBe(boro.perBighaCosts.labor * 2);
  });

  it('treats bad totals as zero', () => {
    expect(sumItems(costItemsForTotal(boro, 1, Number.NaN))).toBe(0);
    expect(sumItems(costItemsForTotal(boro, 1, -50))).toBe(0);
  });
});

describe('parseNumberInput', () => {
  it('reads Latin and Bangla digits', () => {
    expect(parseNumberInput('1200')).toBe(1200);
    expect(parseNumberInput('১২০০')).toBe(1200);
    expect(parseNumberInput('১,২০০')).toBe(1200);
    expect(parseNumberInput('১.৫')).toBe(1.5);
    expect(parseNumberInput(' ৳ 50 ')).toBe(50);
    expect(parseNumberInput('2.')).toBe(2);
  });
  it('rejects empty and non-numeric text', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput(null)).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('-5')).toBeNull();
    expect(parseNumberInput('1.2.3')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats taka with Bangla digits and grouping', () => {
    expect(formatTaka(123456, 'bn')).toBe('৳১,২৩,৪৫৬');
    expect(formatTaka(1500, 'en')).toBe('৳1,500');
    expect(formatTaka(-200, 'en')).toBe('৳200');
  });
  it('labels land', () => {
    expect(landLabel(1.5, 'bigha', 'bn')).toBe('১.৫ বিঘা');
    expect(landLabel(50, 'decimal', 'en')).toBe('50 decimal');
  });
});
