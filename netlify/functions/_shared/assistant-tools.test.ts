import { describe, expect, it, vi } from 'vitest';
import {
  TOOL_DECLARATIONS,
  TOOL_NAMES,
  canonicalCrop,
  createAssistantTools,
  findBulletinItems,
  matchMarket,
  quickAnswerFromTools,
  resolveLocation,
  type AssistantToolDeps,
} from './assistant-tools.ts';
import { farmActions, farmActionsFromFeed, todayActionInput, weekActionsFromFeed } from './farm-actions.ts';
import { matchCommodities } from './market-prices.ts';
import { cleanAnswer, type TodayReading } from './assistant-core.ts';
import { signalsSpeech, todaySignals } from '../../../src/utils/todaySignals.ts';
import type { FarmerFacts } from './farmer-context.ts';
import type { BulletinPayload } from './market-bulletin.ts';

const signal = new AbortController().signal;

/** A /api/weathernext-3 shaped payload: rain possible today, calm wind. */
const FEED = {
  provider: 'Open-Meteo (5 km grid)',
  current: { time: '2026-11-28T09:00', temperature_2m: 26, relative_humidity_2m: 70, wind_speed_10m: 8 },
  hourly: {
    time: ['2026-11-28T09:00', '2026-11-28T10:00', '2026-11-28T11:00'],
    precipitation_probability: [10, 30, 20],
  },
  daily: {
    time: ['2026-11-28', '2026-11-29', '2026-11-30'],
    precipitation_probability_max: [30, 70, 5],
    temperature_2m_max: [28, 27, 29],
    temperature_2m_min: [17, 18, 16],
    wind_speed_10m_max: [10, 12, 9],
  },
};

const BULLETIN: BulletinPayload = {
  source: 'DAM',
  sourceUrl: 'https://market.dam.gov.bd/market_daily_price_report',
  fetchedAt: '2026-11-28T03:00:00.000Z',
  stale: false,
  items: [
    { name: 'পেঁয়াজ (দেশী)', low: 110, high: 120, changePct: 2, direction: 'up' },
    { name: 'বোরো চাল - মোটা', low: 52, high: 55, changePct: 0, direction: 'flat' },
    { name: 'বোরো চাল - সরু', low: 72, high: 75, changePct: 0, direction: 'flat' },
    { name: 'কাঁচা মরিচ', low: 80, high: 100, changePct: -5, direction: 'down' },
  ],
  matched: [],
  missing: [],
  itemCount: 4,
};

const FACTS: FarmerFacts = {
  today: '2026-11-28',
  profile: { mainCrop: 'potato', location: { latitude: 24.1234, longitude: 89.0567 } },
  season: {
    source: 'season_record',
    crop: 'potato',
    cropName: 'Potato',
    sowingDate: '2026-11-01',
    dayNumber: 28,
    calendarStage: 'Vegetative growth',
    nextStep: { name: 'Earthing up', action: 'Earth up the rows', dueDate: '2026-12-05', inDays: 7 },
    calendarNote: null,
  },
  money: {
    currency: 'BDT',
    costTotal: 12500,
    costCount: 4,
    salesTotal: null,
    soldMon: null,
    profit: null,
    topCategories: [{ category: 'seed', label: 'Seed', amount: 8000 }],
  },
  tasks: [{ title: 'Irrigate plot 2', dueDate: '2026-11-27', overdue: true, crop: 'potato' }],
  area: {
    areaName: 'Ishwardi, Pabna',
    warnings: [{ crop: 'potato', problem: 'late blight', farmers: 4, lastDay: '2026-11-26' }],
    localPrice: null,
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const makeDeps = (over: Partial<AssistantToolDeps> = {}): AssistantToolDeps & { weatherCalls: Array<[number, number]> } => {
  const weatherCalls: Array<[number, number]> = [];
  return {
    weatherCalls,
    fetchWeatherFeed: async (lat, lon) => {
      weatherCalls.push([lat, lon]);
      return FEED;
    },
    getBulletin: async () => BULLETIN,
    adminFetch: async () => json(404, {}),
    now: () => new Date('2026-11-28T04:00:00Z'),
    ...over,
  };
};

const make = (
  facts: FarmerFacts = FACTS,
  location: { lat: number; lon: number } | null = null,
  deps = makeDeps(),
  lang: 'bn' | 'en' = 'bn',
  reading: TodayReading | null = null
) => ({ runner: createAssistantTools({ uid: 'farmer-1', lang, facts, location, reading, deps }), deps });

describe('declarations', () => {
  it('declares exactly the read tools, none of them writes', () => {
    expect(TOOL_NAMES).toEqual([
      'get_today_farm_actions',
      'get_week_forecast',
      'get_my_season',
      'get_my_money',
      'get_market_price',
      'get_area_warnings',
      'get_open_tasks',
      'lookup_disease',
    ]);
    for (const d of TOOL_DECLARATIONS) {
      expect(d.name).toMatch(/^(get|lookup)_/);
      // No tool takes a uid, a path or a URL from the model.
      expect(Object.keys((d.parameters as any)?.properties ?? {})).not.toEqual(expect.arrayContaining(['uid']));
      expect(JSON.stringify(d.parameters ?? {})).not.toMatch(/uid|url|path/i);
    }
  });

  it('omits parameters entirely for tools without arguments (no empty OBJECT schema)', () => {
    const noArgs = ['get_today_farm_actions', 'get_week_forecast', 'get_my_season', 'get_area_warnings', 'get_open_tasks'];
    for (const d of TOOL_DECLARATIONS) {
      if (noArgs.includes(d.name)) expect('parameters' in d).toBe(false);
      else expect(Object.keys((d.parameters as any).properties).length).toBeGreaterThan(0);
    }
  });
});

describe('resolveLocation', () => {
  it('prefers the request location, else the farm profile, rounded to 2 decimals', () => {
    expect(resolveLocation({ location: { lat: 23.811, lon: 90.4125 }, facts: FACTS })).toEqual({ lat: 23.81, lon: 90.41, from: 'request' });
    expect(resolveLocation({ location: null, facts: FACTS })).toEqual({ lat: 24.12, lon: 89.06, from: 'farm_profile' });
    expect(resolveLocation({ location: null, facts: {} })).toBeNull();
  });
});

describe('weather tools', () => {
  it('today: the same verdicts the Home card computes from the same feed', async () => {
    const { runner, deps } = make();
    const out: any = await runner.run('get_today_farm_actions', {}, signal);
    expect(out.source).toBe('rules');
    const expected = farmActionsFromFeed(FEED)!.today;
    expect(out.actions.map((a: any) => ({ kind: a.kind, status: a.status, reason: a.reason }))).toEqual(expected);
    expect(out.actions[0]).toMatchObject({ kind: 'spray', status: 'wait', reason: 'rain_possible' });
    expect(out.actions[0].why).toContain('25%');
    expect(out.weather).toMatchObject({ tempC: 26, windKmh: 8, humidityPct: 70, rainChanceNext12hPct: 30, soilMoisture: null });
    expect(out.location).toEqual({ lat: 24.12, lon: 89.06, from: 'farm_profile' });
    expect(deps.weatherCalls).toEqual([[24.12, 89.06]]);
  });

  it('week: weekActionsFromFeed, and one feed fetch shared with today', async () => {
    const { runner, deps } = make(FACTS, { lat: 23.8, lon: 90.4 });
    await runner.run('get_today_farm_actions', {}, signal);
    const out: any = await runner.run('get_week_forecast', {}, signal);
    expect(out.source).toBe('weather_forecast');
    const week = weekActionsFromFeed(FEED);
    expect(out.days.map((d: any) => d.date)).toEqual(week.map((d) => d.date));
    expect(out.days[1]).toMatchObject({ date: '2026-11-29', rainChancePct: 70, tempMaxC: 27, tempMinC: 18 });
    expect(out.days[1].actions[0]).toEqual({ kind: 'spray', status: 'stop', reason: 'rain_likely' });
    expect(deps.weatherCalls).toEqual([[23.8, 90.4]]);
  });

  it('says the location is unknown instead of guessing', async () => {
    const { runner, deps } = make({ ...FACTS, profile: { mainCrop: 'potato' } });
    const out: any = await runner.run('get_today_farm_actions', {}, signal);
    expect(out).toMatchObject({ source: 'app_data', status: 'location_unknown' });
    expect((await runner.run('get_week_forecast', {}, signal) as any).status).toBe('location_unknown');
    expect(deps.weatherCalls).toEqual([]);
  });

  const READING: TodayReading = {
    readingAt: '2026-11-28T03:50:00.000Z',
    temp: 34,
    humidity: 60,
    windSpeed: 9,
    rainChanceToday: 10,
    rainChanceNext12h: 5,
    soilMoisture: 0.2,
  };

  it('today: uses the client reading with the same rules as Home, and does not fetch', async () => {
    const { runner, deps } = make(FACTS, null, makeDeps(), 'bn', READING);
    const out: any = await runner.run('get_today_farm_actions', {}, signal);
    expect(out.source).toBe('rules');
    const { readingAt: _at, ...c } = READING;
    expect(out.actions.map((a: any) => ({ kind: a.kind, status: a.status, reason: a.reason }))).toEqual(farmActions(todayActionInput(c)));
    expect(out.actions[0]).toMatchObject({ kind: 'spray', status: 'wait', reason: 'too_hot' });
    expect(out.weather).toMatchObject({ tempC: 34, windKmh: 9, soilMoisture: 0.2, readingAt: READING.readingAt });
    expect(out.date).toBe('2026-11-28');
    expect(deps.weatherCalls).toEqual([]);
  });

  it('today: the client reading works without a known location; the week tool still fetches', async () => {
    const { runner, deps } = make({ ...FACTS, profile: {} }, null, makeDeps(), 'bn', READING);
    expect((await runner.run('get_today_farm_actions', {}, signal) as any).source).toBe('rules');
    expect((await runner.run('get_week_forecast', {}, signal) as any).status).toBe('location_unknown');
    const withLoc = make(FACTS, { lat: 23.8, lon: 90.4 }, makeDeps(), 'bn', READING);
    await withLoc.runner.run('get_week_forecast', {}, signal);
    expect(withLoc.deps.weatherCalls).toEqual([[23.8, 90.4]]);
    expect(deps.weatherCalls).toEqual([]);
  });

  it('throws (tool failed) when the feed fails or has no current reading, and retries next time', async () => {
    let n = 0;
    const deps = makeDeps({
      fetchWeatherFeed: async () => {
        n += 1;
        if (n === 1) throw new Error('weather_500');
        return { daily: {} };
      },
    });
    const { runner } = make(FACTS, null, deps);
    await expect(runner.run('get_today_farm_actions', {}, signal)).rejects.toThrow();
    await expect(runner.run('get_today_farm_actions', {}, signal)).rejects.toThrow('no_current_reading');
    expect(n).toBe(2);
  });
});

describe('farmer record tools', () => {
  it('season', async () => {
    const out: any = await make().runner.run('get_my_season', {}, signal);
    expect(out).toMatchObject({
      source: 'farmer_records',
      season: { crop: 'potato', cropNameBn: 'আলু', dayNumber: 28, stageNow: 'Vegetative growth', nextStep: { dueDate: '2026-12-05' } },
    });
    expect((await make({ ...FACTS, season: null }).runner.run('get_my_season', {}, signal) as any).season).toBeNull();
    await expect(make({ ...FACTS, season: undefined }).runner.run('get_my_season', {}, signal)).rejects.toThrow();
  });

  it('money for the active season, also when the crop is named in Bangla', async () => {
    for (const crop of [undefined, 'potato', 'আলু', 'Potato']) {
      const out: any = await make().runner.run('get_my_money', crop ? { crop } : {}, signal);
      expect(out).toMatchObject({ source: 'farmer_records', found: true, active: true, money: { costTotal: 12500, salesTotal: null, profit: null } });
    }
  });

  it('money for another named crop reads only this uid\'s seasons', async () => {
    const paths: string[] = [];
    const adminFetch = vi.fn(async (path: string) => {
      paths.push(path);
      if (path.startsWith('/documents/users/farmer-1/seasons?')) {
        return json(200, {
          documents: [
            { name: 'x/seasons/s1', fields: { crop: { stringValue: 'paddy_boro' }, stage: { stringValue: 'harvested' }, updatedAt: { stringValue: '2026-05-01' } } },
            { name: 'x/seasons/s2', fields: { crop: { stringValue: 'paddy_aman' }, stage: { stringValue: 'harvested' }, updatedAt: { stringValue: '2026-10-01' } } },
            { name: 'x/seasons/s3', fields: { crop: { stringValue: 'potato' } } },
          ],
        });
      }
      if (path.includes('/seasons/s2/expenses')) {
        return json(200, { documents: [{ name: 'e1', fields: { amount: { integerValue: '3000' }, category: { stringValue: 'seed' } } }] });
      }
      if (path.includes('/seasons/s2/sales')) {
        return json(200, { documents: [{ name: 'x1', fields: { quantityMon: { integerValue: '10' }, pricePerMon: { integerValue: '1200' } } }] });
      }
      return json(404, {});
    });
    const { runner } = make(FACTS, null, makeDeps({ adminFetch }));
    const out: any = await runner.run('get_my_money', { crop: 'ধান' }, signal);
    expect(out).toMatchObject({ found: true, crop: 'paddy_aman', active: false, money: { costTotal: 3000, salesTotal: 12000, profit: 9000 } });
    expect(paths.every((p) => p.startsWith('/documents/users/farmer-1/'))).toBe(true);
  });

  it('money for a named crop prefers an open season over a newer harvested one', async () => {
    const asked: string[] = [];
    const adminFetch = vi.fn(async (path: string) => {
      if (path.startsWith('/documents/users/farmer-1/seasons?')) {
        return json(200, {
          documents: [
            { name: 'x/seasons/old', fields: { crop: { stringValue: 'onion' }, stage: { stringValue: 'harvested' }, updatedAt: { stringValue: '2026-11-20' } } },
            { name: 'x/seasons/open1', fields: { crop: { stringValue: 'onion' }, stage: { stringValue: 'growing' }, updatedAt: { stringValue: '2026-09-01' } } },
            { name: 'x/seasons/open2', fields: { crop: { stringValue: 'onion' }, stage: { stringValue: 'sowing' }, updatedAt: { stringValue: '2026-10-01' } } },
          ],
        });
      }
      const m = /seasons\/([^/]+)\/expenses/.exec(path);
      if (m) asked.push(m[1]);
      return json(404, {});
    });
    const out: any = await make(FACTS, null, makeDeps({ adminFetch })).runner.run('get_my_money', { crop: 'পেঁয়াজ' }, signal);
    expect(out).toMatchObject({ found: true, active: true });
    expect(asked).toEqual(['open2']);
  });

  it('money: a crop with no season is unknown, not zero', async () => {
    const adminFetch = async () => json(200, { documents: [] });
    const out: any = await make(FACTS, null, makeDeps({ adminFetch })).runner.run('get_my_money', { crop: 'onion' }, signal);
    expect(out).toMatchObject({ source: 'farmer_records', found: false });
    expect(out.money).toBeUndefined();
  });

  it('money: unknown facts make the tool fail', async () => {
    await expect(make({ ...FACTS, money: undefined }).runner.run('get_my_money', {}, signal)).rejects.toThrow();
  });

  it('open tasks and area warnings', async () => {
    const tasks: any = await make().runner.run('get_open_tasks', {}, signal);
    expect(tasks).toMatchObject({ source: 'farmer_records', tasks: [{ title: 'Irrigate plot 2', overdue: true }] });
    const area: any = await make().runner.run('get_area_warnings', {}, signal);
    expect(area).toMatchObject({ source: 'app_data', areaKnown: true, area: 'Ishwardi, Pabna', warnings: [{ farmers: 4 }] });
    expect((await make({ ...FACTS, area: null }).runner.run('get_area_warnings', {}, signal) as any).areaKnown).toBe(false);
    await expect(make({ ...FACTS, tasks: undefined }).runner.run('get_open_tasks', {}, signal)).rejects.toThrow();
  });
});

describe('get_market_price', () => {
  it('reads the bulletin range and date', async () => {
    const out: any = await make().runner.run('get_market_price', { crop: 'পেঁয়াজ' }, signal);
    expect(out).toMatchObject({
      source: 'govt_bulletin',
      found: true,
      date: '2026-11-28',
      stale: false,
      prices: [{ item: 'পেঁয়াজ (দেশী)', low: 110, high: 120 }],
    });
    const en: any = await make().runner.run('get_market_price', { crop: 'Onion' }, signal);
    expect(en.prices[0].low).toBe(110);
  });

  it('rice / paddy: lists the rice items and says it is rice, not paddy', async () => {
    const out: any = await make().runner.run('get_market_price', { crop: 'ধান' }, signal);
    expect(out.prices.map((p: any) => p.item)).toEqual(['বোরো চাল - মোটা', 'বোরো চাল - সরু']);
    expect(out.prices.map((p: any) => p.label)).toEqual(['Coarse Rice', 'Fine Rice (Miniket)']);
    expect(out.note).toContain('not paddy');
  });

  it("puts the Market screen's matched item first, with its label, extra hits after", async () => {
    const items = [
      { name: 'রসুন - আমদানিকৃত', low: 200, high: 220, changePct: 0, direction: 'flat' as const },
      { name: 'রসুন - দেশী', low: 150, high: 170, changePct: 1, direction: 'up' as const },
    ];
    const { runner } = make(FACTS, null, makeDeps({ getBulletin: async () => ({ ...BULLETIN, items }) }));
    const out: any = await runner.run('get_market_price', { crop: 'রসুন' }, signal);
    const screen = matchCommodities(items).matched.find((m) => m.id === 'natore_garlic')!;
    expect(out.prices[0]).toMatchObject({ item: screen.item!.name, label: screen.label, low: 150, high: 170 });
    expect(out.prices[1]).toMatchObject({ item: 'রসুন - আমদানিকৃত', label: null });
    expect(matchMarket(items, 'garlic', 'garlic').primary.map((p) => p.id)).toEqual(['natore_garlic']);
    // The screen's own English label also finds it.
    expect(matchMarket(BULLETIN.items, 'green_chilli', 'Green Chilli').primary[0].label).toBe('Green Chilli');
  });

  it('says clearly when the crop is not in the bulletin, with the Market screen label', async () => {
    const out: any = await make().runner.run('get_market_price', { crop: 'আলু' }, signal);
    expect(out).toMatchObject({ source: 'govt_bulletin', found: false, notInBulletin: { id: 'munshiganj_potato', label: 'Potato' } });
    expect(out.note).toContain("Potato is NOT in today's bulletin");
    expect(out.prices).toBeUndefined();
    const other: any = await make().runner.run('get_market_price', { crop: 'dragon fruit' }, signal);
    expect(other).toMatchObject({ found: false });
    expect(other.note).toContain("not in today's government bulletin");
  });

  it('labels a stale bulletin', async () => {
    const { runner } = make(FACTS, null, makeDeps({ getBulletin: async () => ({ ...BULLETIN, stale: true }) }));
    const out: any = await runner.run('get_market_price', { crop: 'chili' }, signal);
    expect(out).toMatchObject({ stale: true, found: true });
    expect(out.note).toContain('last known');
  });

  it('fails when the bulletin cannot be read', async () => {
    const { runner } = make(FACTS, null, makeDeps({ getBulletin: async () => { throw new Error('down'); } }));
    await expect(runner.run('get_market_price', { crop: 'onion' }, signal)).rejects.toThrow();
  });

  it('findBulletinItems matches Bangla whatever the input form', () => {
    expect(findBulletinItems(BULLETIN.items, 'chili', 'chilli')[0].name).toBe('কাঁচা মরিচ');
    expect(findBulletinItems(BULLETIN.items, 'potato', 'potato')).toEqual([]);
  });
});

describe('quickAnswerFromTools', () => {
  it("today: the Home card's own sentences from the tool's numbers, in the answer language", async () => {
    const result: any = await make().runner.run('get_today_farm_actions', {}, signal);
    const bn = quickAnswerFromTools([{ name: 'get_today_farm_actions', result }], 'bn')!;
    const home = todaySignals({ temp: 26, humidity: 70, windSpeed: 8, rainChanceToday: 30, rainChanceNext12h: 30 });
    expect(bn).toContain(signalsSpeech(home, 'bn'));
    expect(home[0].status).toBe(result.actions[0].status);
    expect(quickAnswerFromTools([{ name: 'get_today_farm_actions', result }], 'en')).toContain(signalsSpeech(home, 'en'));
  });

  it('market: the bulletin range with date in Bangla digits after cleaning, or the not-in-bulletin line', async () => {
    const onion: any = await make().runner.run('get_market_price', { crop: 'পেঁয়াজ' }, signal);
    const bn = cleanAnswer(quickAnswerFromTools([{ name: 'get_market_price', result: onion }], 'bn')!, 'bn');
    expect(bn).toContain('পেঁয়াজ (দেশী): ৳১১০–১২০');
    expect(bn).toContain('২০২৬-১১-২৮');
    const en = quickAnswerFromTools([{ name: 'get_market_price', result: onion }], 'en')!;
    expect(en).toContain('Deshi Onion: Tk 110–120');
    const potato: any = await make().runner.run('get_market_price', { crop: 'আলু' }, signal);
    expect(quickAnswerFromTools([{ name: 'get_market_price', result: potato }], 'bn')).toContain('আলু আজকের সরকারি দৈনিক বাজারদর বুলেটিনে নেই');
    expect(quickAnswerFromTools([{ name: 'get_market_price', result: potato }], 'en')).toContain('Potato is not in today');
  });

  it('is null when no today or market data came back', () => {
    expect(quickAnswerFromTools([], 'bn')).toBeNull();
    expect(quickAnswerFromTools([{ name: 'get_my_season', result: { source: 'farmer_records' } }], 'bn')).toBeNull();
    expect(quickAnswerFromTools([{ name: 'get_today_farm_actions', result: { source: 'app_data', status: 'location_unknown' } }], 'bn')).toBeNull();
    expect(quickAnswerFromTools([{ name: 'get_market_price', result: { source: 'govt_bulletin', found: false } }], 'en')).toBeNull();
  });
});

describe('lookup_disease', () => {
  it('finds an entry by English or Bangla name, in the answer language', async () => {
    const bn: any = await make().runner.run('lookup_disease', { name: 'late blight', crop: 'potato' }, signal);
    expect(bn).toMatchObject({ source: 'app_data', found: true });
    expect(bn.diseases[0].name.toLowerCase()).toContain('late blight');
    expect(bn.diseases[0].symptoms).toMatch(/[ঀ-৿]/);
    const en: any = await make(FACTS, null, makeDeps(), 'en').runner.run('lookup_disease', { name: bn.diseases[0].nameBn }, signal);
    expect(en.found).toBe(true);
    expect(en.diseases[0].symptoms).not.toMatch(/[ঀ-৿]/);
  });

  it('says when it is not in the reference', async () => {
    const out: any = await make().runner.run('lookup_disease', { name: 'zzzz unknown' }, signal);
    expect(out).toMatchObject({ source: 'app_data', found: false });
  });
});

describe('canonicalCrop', () => {
  it('maps names to one key', () => {
    expect(canonicalCrop('আলু')).toBe('potato');
    expect(canonicalCrop('Rice')).toBe('paddy');
    expect(canonicalCrop('paddy_boro')).toBe('paddy');
    expect(canonicalCrop('Chilli')).toBe('chili');
    expect(canonicalCrop('')).toBe('');
    expect(canonicalCrop(undefined)).toBe('');
  });

  it('rejects an unknown tool', async () => {
    await expect(make().runner.run('write_cost', {}, signal)).rejects.toThrow('unknown_tool');
  });
});
