import { describe, expect, it } from 'vitest';
import {
  MAX_LAND_SIZE,
  PLOT_NAME_MAX,
  cleanPlotInput,
  cleanSaleInput,
  cleanSeasonProgress,
  plotDecimals,
  scoreFarmRecord,
  seasonTotals,
  type FarmRecordFacts,
} from './farm-record-model.ts';

describe('cleanPlotInput', () => {
  const ok = { name: '  Home   plot ', landSize: 2.456, landUnit: 'bigha', tenure: 'own' };

  it('tidies a good plot', () => {
    expect(cleanPlotInput(ok)).toEqual({ name: 'Home plot', landSize: 2.46, landUnit: 'bigha', tenure: 'own' });
  });

  it('accepts a size sent as text', () => {
    expect(cleanPlotInput({ ...ok, landSize: '3' })?.landSize).toBe(3);
  });

  it('cuts a long name', () => {
    expect(cleanPlotInput({ ...ok, name: 'x'.repeat(200) })?.name).toHaveLength(PLOT_NAME_MAX);
  });

  it('refuses what is not believable', () => {
    expect(cleanPlotInput(null)).toBeNull();
    expect(cleanPlotInput('plot')).toBeNull();
    expect(cleanPlotInput({ ...ok, name: '   ' })).toBeNull();
    expect(cleanPlotInput({ ...ok, landSize: 0 })).toBeNull();
    expect(cleanPlotInput({ ...ok, landSize: -1 })).toBeNull();
    expect(cleanPlotInput({ ...ok, landSize: 'abc' })).toBeNull();
    expect(cleanPlotInput({ ...ok, landSize: MAX_LAND_SIZE + 1 })).toBeNull();
    expect(cleanPlotInput({ ...ok, landUnit: 'hectare' })).toBeNull();
    expect(cleanPlotInput({ ...ok, tenure: 'squat' })).toBeNull();
  });

  it('converts land to decimals', () => {
    expect(plotDecimals({ landSize: 2, landUnit: 'bigha' })).toBe(66);
    expect(plotDecimals({ landSize: 1, landUnit: 'acre' })).toBe(100);
    expect(plotDecimals({ landSize: 7, landUnit: 'decimal' })).toBe(7);
    expect(plotDecimals({ landSize: 10, landUnit: 'katha' })).toBeCloseTo(16.5);
  });
});

describe('cleanSeasonProgress', () => {
  it('keeps good fields', () => {
    expect(
      cleanSeasonProgress({
        plotId: 'plot_1',
        stage: 'harvested',
        sowingDate: '2026-07-01',
        harvestDate: '2026-11-01',
        harvestMon: 30.456,
      })
    ).toEqual({ plotId: 'plot_1', stage: 'harvested', sowingDate: '2026-07-01', harvestDate: '2026-11-01', harvestMon: 30.46 });
  });

  it('drops wrong fields and never guesses', () => {
    expect(cleanSeasonProgress({ plotId: 'a/b', stage: 'dead', sowingDate: '1 July', harvestDate: 5, harvestMon: -1 })).toEqual({});
    expect(cleanSeasonProgress({ harvestMon: 'lots' })).toEqual({});
    expect(cleanSeasonProgress({ harvestMon: 100_001 })).toEqual({});
  });

  it('keeps a harvest of exactly 0 but not a missing one', () => {
    expect(cleanSeasonProgress({ harvestMon: 0 })).toEqual({ harvestMon: 0 });
    expect(cleanSeasonProgress({ harvestMon: null })).toEqual({});
    expect(cleanSeasonProgress({})).toEqual({});
  });

  it('drops a harvest date before the sowing date', () => {
    expect(cleanSeasonProgress({ sowingDate: '2026-07-10', harvestDate: '2026-07-01' })).toEqual({ sowingDate: '2026-07-10' });
  });

  it('copes with junk input', () => {
    expect(cleanSeasonProgress(null)).toEqual({});
    expect(cleanSeasonProgress('x')).toEqual({});
  });
});

describe('cleanSaleInput', () => {
  const today = '2026-11-28';
  const ok = { quantityMon: 12.345, pricePerMon: 1250.4, buyerType: 'trader', date: '2026-11-20' };

  it('tidies a good sale', () => {
    expect(cleanSaleInput(ok, today)).toEqual({ quantityMon: 12.35, pricePerMon: 1250, buyerType: 'trader', date: '2026-11-20' });
  });

  it('allows today but refuses a future date', () => {
    expect(cleanSaleInput({ ...ok, date: today }, today)).not.toBeNull();
    expect(cleanSaleInput({ ...ok, date: '2026-11-29' }, today)).toBeNull();
  });

  it('refuses what is not believable', () => {
    expect(cleanSaleInput(null, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, quantityMon: 0 }, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, quantityMon: 100_001 }, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, pricePerMon: 0 }, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, pricePerMon: 100_001 }, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, pricePerMon: 'x' }, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, buyerType: 'friend' }, today)).toBeNull();
    expect(cleanSaleInput({ ...ok, date: 'yesterday' }, today)).toBeNull();
  });
});

describe('seasonTotals', () => {
  it('has no profit until something is sold', () => {
    const totals = seasonTotals([{ amount: 500 }, { amount: 700 }], []);
    expect(totals).toMatchObject({ costTotal: 1200, costCount: 2, soldMon: 0, revenue: 0, profit: null, avgPricePerMon: null });
  });

  it('has no profit when something is sold but no costs are noted', () => {
    const totals = seasonTotals([], [{ quantityMon: 10, pricePerMon: 1000 }]);
    expect(totals).toMatchObject({ costTotal: 0, costCount: 0, soldMon: 10, revenue: 10000, profit: null, avgPricePerMon: 1000 });
  });

  it('shows a profit as soon as one cost is noted, even a zero one', () => {
    const totals = seasonTotals([{ amount: 0 }], [{ quantityMon: 10, pricePerMon: 1000 }]);
    expect(totals.costCount).toBe(1);
    expect(totals.profit).toBe(10000);
  });

  it('has no profit with neither costs nor sales', () => {
    expect(seasonTotals([], []).profit).toBeNull();
  });

  it('works out revenue, profit and the average price', () => {
    const totals = seasonTotals(
      [{ amount: 1000 }],
      [
        { quantityMon: 10, pricePerMon: 1000 },
        { quantityMon: 5, pricePerMon: 1300 },
      ]
    );
    expect(totals.soldMon).toBe(15);
    expect(totals.revenue).toBe(16500);
    expect(totals.profit).toBe(15500);
    expect(totals.avgPricePerMon).toBe(1100);
  });

  it('can show a loss and ignores a bad cost amount', () => {
    const totals = seasonTotals([{ amount: 5000 }, { amount: NaN }], [{ quantityMon: 2, pricePerMon: 1000 }]);
    expect(totals.costTotal).toBe(5000);
    expect(totals.profit).toBe(-3000);
  });
});

describe('scoreFarmRecord', () => {
  const empty: FarmRecordFacts = {
    plots: 0,
    totalLandDecimals: 0,
    seasons: 0,
    seasonsWithCosts: 0,
    seasonsWithHarvest: 0,
    seasonsWithSales: 0,
    activeMonths: 0,
    cropChecks: 0,
  };
  const points = (facts: Partial<FarmRecordFacts>, key: string) =>
    scoreFarmRecord({ ...empty, ...facts }).pillars.find((p) => p.key === key)!.points;

  it('is 0 and "starting" for an empty record or no facts at all', () => {
    expect(scoreFarmRecord(empty)).toMatchObject({ score: 0, level: 'starting' });
    expect(scoreFarmRecord({}).score).toBe(0);
  });

  it('has the six pillars in a fixed order, and their maximums add up to 100', () => {
    const { pillars } = scoreFarmRecord(empty);
    expect(pillars.map((p) => p.key)).toEqual(['land', 'costs', 'harvest', 'sales', 'regularity', 'cropCare']);
    expect(pillars.reduce((sum, p) => sum + p.max, 0)).toBe(100);
  });

  it('caps every pillar at its maximum', () => {
    const huge = {
      plots: 500,
      totalLandDecimals: 1e9,
      seasonsWithCosts: 500,
      seasonsWithHarvest: 500,
      seasonsWithSales: 500,
      activeMonths: 500,
      cropChecks: 500,
    };
    const result = scoreFarmRecord({ ...empty, ...huge });
    for (const pillar of result.pillars) expect(pillar.points).toBe(pillar.max);
    expect(result.score).toBe(100);
    expect(result.level).toBe('strong');
  });

  it('scores each pillar', () => {
    expect(points({ plots: 1 }, 'land')).toBe(10);
    expect(points({ plots: 1, totalLandDecimals: 5 }, 'land')).toBe(15);
    expect(points({ totalLandDecimals: 5 }, 'land')).toBe(5);
    expect(points({ seasonsWithCosts: 2 }, 'costs')).toBe(20);
    expect(points({ seasonsWithCosts: 3 }, 'costs')).toBe(25);
    expect(points({ seasonsWithHarvest: 1 }, 'harvest')).toBe(8);
    expect(points({ seasonsWithHarvest: 2 }, 'harvest')).toBe(15);
    expect(points({ seasonsWithSales: 1 }, 'sales')).toBe(8);
    expect(points({ seasonsWithSales: 2 }, 'sales')).toBe(15);
    expect(points({ activeMonths: 6 }, 'regularity')).toBe(12);
    expect(points({ activeMonths: 12 }, 'regularity')).toBe(20);
    expect(points({ activeMonths: 40 }, 'regularity')).toBe(20);
    expect(points({ cropChecks: 3 }, 'cropCare')).toBe(6);
    expect(points({ cropChecks: 9 }, 'cropCare')).toBe(10);
  });

  it('ignores negative, fractional and non-number facts', () => {
    const result = scoreFarmRecord({ plots: -3, seasonsWithCosts: 'x' as any, cropChecks: 2.9 });
    expect(points({ cropChecks: 2.9 }, 'cropCare')).toBe(4);
    expect(result.pillars.find((p) => p.key === 'land')!.points).toBe(0);
    expect(result.pillars.find((p) => p.key === 'costs')!.points).toBe(0);
  });

  it('changes level exactly at 25, 50 and 75', () => {
    const check = (facts: Partial<FarmRecordFacts>, score: number, level: string) => {
      const result = scoreFarmRecord({ ...empty, ...facts });
      expect(result.score).toBe(score);
      expect(result.level).toBe(level);
    };
    // 20 (costs) + 4 (two crop checks)
    check({ seasonsWithCosts: 2, cropChecks: 2 }, 24, 'starting');
    // 20 (costs) + 5 (land size only)
    check({ seasonsWithCosts: 2, totalLandDecimals: 1 }, 25, 'building');
    // 5 + 20 + 8 (harvest) + 8 (sales) + 8 (4 months)
    check({ totalLandDecimals: 1, seasonsWithCosts: 2, seasonsWithHarvest: 1, seasonsWithSales: 1, activeMonths: 4 }, 49, 'building');
    // 10 (a plot) + 20 + 8 + 8 + 4 (2 months)
    check({ plots: 1, seasonsWithCosts: 2, seasonsWithHarvest: 1, seasonsWithSales: 1, activeMonths: 2 }, 50, 'good');
    // 15 + 25 + 15 + 15 + 4
    check({ plots: 1, totalLandDecimals: 1, seasonsWithCosts: 3, seasonsWithHarvest: 2, seasonsWithSales: 2, activeMonths: 2 }, 74, 'good');
    // 15 + 25 + 15 + 8 + 12 (6 months)
    check({ plots: 1, totalLandDecimals: 1, seasonsWithCosts: 3, seasonsWithHarvest: 2, seasonsWithSales: 1, activeMonths: 6 }, 75, 'strong');
  });

  it('gives the same score for the same facts', () => {
    const facts = { ...empty, plots: 2, totalLandDecimals: 80, seasonsWithCosts: 1, activeMonths: 3 };
    expect(scoreFarmRecord(facts)).toEqual(scoreFarmRecord({ ...facts }));
  });
});
