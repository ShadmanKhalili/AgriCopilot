import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../firestore', () => ({ db: {} }));

import {
  addSale,
  deletePlot,
  deleteSale,
  listPlots,
  listSales,
  loadFarmRecord,
  parseStoredScore,
  refreshRecordScore,
  fetchRecordScore,
  savePlot,
  updateSeasonProgress,
} from './farmRecord';
import { addExpense, deleteSeason, listSeasons, saveSeason } from './seasons';
import { dhakaDateString } from '../utils/farmTaskDates';

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const plotInput = { name: '  বাড়ির পাশের জমি ', landSize: 33, landUnit: 'decimal', tenure: 'own' } as const;
const plan = {
  crop: 'potato',
  landSize: 10,
  landUnit: 'decimal',
  expectedYieldMon: 40,
  expectedPricePerMon: 900,
  plannedCost: 12000,
} as const;
const today = dhakaDateString();
const sale = { quantityMon: 10, pricePerMon: 1000, buyerType: 'trader', date: today } as const;

beforeEach(() => store.clear());

describe('plots (this device)', () => {
  it('creates, updates and deletes', async () => {
    const created = savePlot(null, plotInput);
    expect(created).not.toBeNull();
    await created!.saved;
    expect(created!.item.name).toBe('বাড়ির পাশের জমি');
    expect(await listPlots(null)).toHaveLength(1);

    const updated = savePlot(null, { ...plotInput, landSize: 50 }, created!.item.id);
    expect(updated!.item.id).toBe(created!.item.id);
    expect(updated!.item.createdAt).toBe(created!.item.createdAt);
    const list = await listPlots(null);
    expect(list).toHaveLength(1);
    expect(list[0].landSize).toBe(50);

    await deletePlot(null, created!.item.id);
    expect(await listPlots(null)).toEqual([]);
  });

  it('refuses invalid input and an unknown id', () => {
    expect(savePlot(null, { ...plotInput, name: '   ' })).toBeNull();
    expect(savePlot(null, { ...plotInput, landSize: 0 })).toBeNull();
    expect(savePlot(null, { ...plotInput, landUnit: 'hectare' as never })).toBeNull();
    expect(savePlot(null, plotInput, 'missing')).toBeNull();
  });

  it('stops at 20 plots', () => {
    for (let i = 0; i < 20; i++) expect(savePlot(null, plotInput)).not.toBeNull();
    expect(savePlot(null, plotInput)).toBeNull();
  });

  it('survives garbage in storage', async () => {
    store.set('krishi_plots_v1', '{not json');
    expect(await listPlots(null)).toEqual([]);
    store.set('krishi_plots_v1', JSON.stringify({ plots: [null, 5, { id: 'x', name: '', landSize: 'a' }] }));
    expect(await listPlots(null)).toEqual([]);
  });
});

describe('season progress (this device)', () => {
  it('sets progress and keeps the plan fields', async () => {
    const season = saveSeason(null, plan).item;
    const result = updateSeasonProgress(null, season.id, {
      stage: 'growing',
      sowingDate: '2026-11-20',
      plotId: 'plot-1',
    });
    expect(result).not.toBeNull();
    expect(result!.item.crop).toBe('potato');
    expect(result!.item.stage).toBe('growing');
    const [stored] = await listSeasons(null);
    expect(stored.stage).toBe('growing');
    expect(stored.sowingDate).toBe('2026-11-20');
    expect(stored.plotId).toBe('plot-1');
    expect(stored.plannedCost).toBe(12000);
  });

  it('survives editing the plan afterwards', async () => {
    const season = saveSeason(null, plan).item;
    updateSeasonProgress(null, season.id, { stage: 'harvested', harvestMon: 35, plotId: 'plot-1' });
    const [before] = await listSeasons(null);
    const edited = saveSeason(null, { ...plan, plannedCost: 15000 }, before);
    expect(edited.item.stage).toBe('harvested');
    const [after] = await listSeasons(null);
    expect(after.plannedCost).toBe(15000);
    expect(after.stage).toBe('harvested');
    expect(after.harvestMon).toBe(35);
    expect(after.plotId).toBe('plot-1');

    // Even when the screen passes only id and createdAt.
    saveSeason(null, { ...plan, plannedCost: 16000 }, { id: after.id, createdAt: after.createdAt });
    const [last] = await listSeasons(null);
    expect(last.plannedCost).toBe(16000);
    expect(last.harvestMon).toBe(35);
  });

  it('refuses nothing-to-save, a missing season, and bad values it drops', async () => {
    const season = saveSeason(null, plan).item;
    expect(updateSeasonProgress(null, season.id, {})).toBeNull();
    expect(updateSeasonProgress(null, season.id, { stage: 'nonsense' as never })).toBeNull();
    expect(updateSeasonProgress(null, 'gone', { stage: 'growing' })).toBeNull();
    // harvest before sowing is dropped when both are in the stored season
    updateSeasonProgress(null, season.id, { sowingDate: '2026-11-20' });
    updateSeasonProgress(null, season.id, { harvestDate: '2026-11-01', stage: 'growing' });
    const [stored] = await listSeasons(null);
    expect(stored.harvestDate).toBeUndefined();
  });

  it('clears a progress field when it is sent as null, and keeps the rest', async () => {
    const season = saveSeason(null, plan).item;
    updateSeasonProgress(null, season.id, { sowingDate: '2026-11-20', harvestMon: 30, stage: 'growing' });
    const result = updateSeasonProgress(null, season.id, { sowingDate: null, harvestMon: null });
    expect(result).not.toBeNull();
    expect(result!.item).not.toHaveProperty('sowingDate');
    expect(result!.item).not.toHaveProperty('harvestMon');
    const [stored] = await listSeasons(null);
    expect(stored.sowingDate).toBeUndefined();
    expect(stored.harvestMon).toBeUndefined();
    expect(stored.stage).toBe('growing');
    expect(stored.crop).toBe('potato');
  });

  it('ignores null for fields that cannot be cleared', async () => {
    const season = saveSeason(null, plan).item;
    updateSeasonProgress(null, season.id, { stage: 'growing' });
    expect(updateSeasonProgress(null, season.id, { stage: null as never })).toBeNull();
    const [stored] = await listSeasons(null);
    expect(stored.stage).toBe('growing');
  });
});

describe('sales (this device)', () => {
  it('adds, lists newest first and deletes', async () => {
    const season = saveSeason(null, plan).item;
    const first = addSale(null, season.id, { ...sale, date: '2026-01-01' });
    const second = addSale(null, season.id, sale);
    expect(first && second).toBeTruthy();
    const list = await listSales(null, season.id);
    expect(list.map((s) => s.id)).toEqual([second!.item.id, first!.item.id]);
    await deleteSale(null, season.id, first!.item.id);
    expect((await listSales(null, season.id)).map((s) => s.id)).toEqual([second!.item.id]);
  });

  it('keeps sales per season and refuses bad ones', async () => {
    const a = saveSeason(null, plan).item;
    const b = saveSeason(null, plan).item;
    addSale(null, a.id, sale);
    expect(await listSales(null, b.id)).toEqual([]);
    expect(addSale(null, a.id, { ...sale, quantityMon: 0 })).toBeNull();
    expect(addSale(null, a.id, { ...sale, pricePerMon: 0 })).toBeNull();
    expect(addSale(null, a.id, { ...sale, buyerType: 'friend' as never })).toBeNull();
    expect(addSale(null, a.id, { ...sale, date: '2999-01-01' })).toBeNull();
    expect(addSale(null, '', sale)).toBeNull();
  });

  it('goes with its season when the season is deleted', async () => {
    const season = saveSeason(null, plan).item;
    addSale(null, season.id, sale);
    await deleteSeason(null, season.id);
    expect(await listSales(null, season.id)).toEqual([]);
  });
});

describe('loadFarmRecord (this device)', () => {
  it('joins plots, seasons, costs and sales with totals', async () => {
    const plot = savePlot(null, plotInput)!.item;
    const season = saveSeason(null, plan).item;
    updateSeasonProgress(null, season.id, { plotId: plot.id, stage: 'harvested', harvestMon: 38 });
    addExpense(null, season.id, { category: 'seeds', amount: 3000, date: today });
    addExpense(null, season.id, { category: 'labor', amount: 2000, date: today });
    addSale(null, season.id, sale);
    addSale(null, season.id, { ...sale, quantityMon: 5, pricePerMon: 1200 });

    const record = await loadFarmRecord(null);
    expect(record.plots).toHaveLength(1);
    expect(record.seasons).toHaveLength(1);
    const [entry] = record.seasons;
    expect(entry.season.plotId).toBe(plot.id);
    expect(entry.season.harvestMon).toBe(38);
    expect(entry.expenses).toHaveLength(2);
    expect(entry.sales).toHaveLength(2);
    expect(entry.totals).toMatchObject({
      costTotal: 5000,
      costCount: 2,
      soldMon: 15,
      revenue: 16000,
      profit: 11000,
      avgPricePerMon: 1067,
    });
  });

  it('has no profit before a sale, and unlinks a season from a deleted plot', async () => {
    const plot = savePlot(null, plotInput)!.item;
    const season = saveSeason(null, plan).item;
    updateSeasonProgress(null, season.id, { plotId: plot.id });
    await deletePlot(null, plot.id);
    const record = await loadFarmRecord(null);
    expect(record.seasons[0].season.plotId).toBeUndefined();
    expect(record.seasons[0].totals.profit).toBeNull();
  });

  it('is empty on a new device', async () => {
    expect(await loadFarmRecord(null)).toEqual({ plots: [], seasons: [] });
  });
});

describe('record score', () => {
  it('signed out: nothing to fetch, cannot refresh', async () => {
    expect(await fetchRecordScore()).toBeNull();
    expect(await refreshRecordScore()).toEqual({ ok: false, reason: 'signed_out' });
  });

  it('parses a stored score defensively', () => {
    const good = {
      uid: 'u1',
      score: 62.4,
      level: 'good',
      pillars: [
        { key: 'land', points: 15, max: 15 },
        { key: 'bogus', points: 1, max: 1 },
        { key: 'costs', points: 99, max: 25 },
      ],
      facts: { plots: 2, seasons: 3 },
      computedAt: '2026-11-28T00:00:00.000Z',
      version: 1,
    };
    const parsed = parseStoredScore(good)!;
    expect(parsed.score).toBe(62);
    expect(parsed.pillars.map((p) => p.key)).toEqual(['land', 'costs']);
    expect(parsed.pillars[1].points).toBe(25);
    expect(parsed.facts.plots).toBe(2);
    expect(parsed.facts.cropChecks).toBe(0);
    expect(parseStoredScore({ ...good, score: 'x' })).toBeNull();
    expect(parseStoredScore({ ...good, level: 'amazing' })).toBeNull();
    expect(parseStoredScore({ ...good, pillars: 'no' })).toBeNull();
    expect(parseStoredScore(null)).toBeNull();
  });
});
