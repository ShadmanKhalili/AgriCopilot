/**
 * Phase 9: the assistant's READ tools (see docs/PHASE9_ASSISTANT_SPEC.md).
 *
 * Each tool is a Gemini function declaration plus an executor. Executors are
 * scoped to the verified uid in the context: no tool takes a uid, a path or a
 * URL from the model. Every result is compact JSON with a `source` field.
 *
 * Where the facts come from:
 *   get_today_farm_actions  the client's own reading (request `today`) when valid, else the
 *                           /api/weathernext-3 feed (the Home Today card's feed); + farm-actions.ts rules
 *   get_week_forecast       the same feed + weekActionsFromFeed
 *   get_my_season           loadFarmerFacts (season)
 *   get_my_money            loadFarmerFacts (active season) or the named crop's open (else newest) season
 *   get_market_price        the DAM bulletin, the same cache/parse and commodity matching as /api/market-prices
 *   get_area_warnings       loadFarmerFacts (area_summaries for the farmer's upazila)
 *   get_open_tasks          loadFarmerFacts (open tasks)
 *   lookup_disease          src/data/diseaseKb.ts
 *
 * There are no write tools in Phase 9.
 */

import type { AssistantLang, TodayReading, ToolDeclaration, ToolResult, ToolRunner } from './assistant-core.ts';
import { roundCoord } from './assistant-core.ts';
import {
  FARM_THRESHOLDS,
  farmActions,
  farmActionsFromFeed,
  todayActionInput,
  todayConditionsFromFeed,
  weekActionsFromFeed,
  type FarmAction,
  type TodayConditions,
} from './farm-actions.ts';
import { calendarKeyFor, cropDisplayName, dhakaDay, type FarmerFacts } from './farmer-context.ts';
import { seasonTotals } from './farm-record-model.ts';
import { fromFirestoreDocument } from './service-account.ts';
import { NOT_IN_BULLETIN, matchCommodities, type BulletinItem } from './market-prices.ts';
import type { BulletinPayload } from './market-bulletin.ts';
import { MAIN_CROPS } from '../../../src/data/mainCrops.ts';
import { CROP_KNOWLEDGE } from '../../../src/data/diseaseKb.ts';
import { EXPENSE_CATEGORY_LABELS } from '../../../src/utils/seasonMath.ts';
import { signalsSpeech, todaySignals } from '../../../src/utils/todaySignals.ts';

export interface AssistantToolDeps {
  /** The /api/weathernext-3 payload for a point. Throws when the feed is unavailable. */
  fetchWeatherFeed: (lat: number, lon: number, signal: AbortSignal) => Promise<unknown>;
  /** The parsed DAM bulletin (cached). Throws when it cannot be read. */
  getBulletin: (signal: AbortSignal) => Promise<BulletinPayload>;
  /** Firestore REST as the service account (only for a named crop's season in get_my_money). */
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
}

export interface AssistantToolContext {
  /** The verified caller. Every read is for this uid only. */
  uid: string;
  lang: AssistantLang;
  facts: FarmerFacts;
  /** The request's location, already rounded to 2 decimals. */
  location: { lat: number; lon: number } | null;
  /** The client's checked, recent weather reading (request `today`); null to use the feed. */
  reading?: TodayReading | null;
  deps: AssistantToolDeps;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

// Tools without arguments have no `parameters` at all: an empty OBJECT schema
// is rejected by some Gemini versions.
export const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: 'get_today_farm_actions',
    description:
      "Today's spray / irrigate / fertilise verdicts (go / wait / stop) with reasons, decided by the app's rules on the live weather at the farm, plus today's weather numbers. The same verdicts as the Home screen. Use for any question about spraying, watering or fertilising today.",
  },
  {
    name: 'get_week_forecast',
    description:
      'The next 7 days at the farm: chance of rain, highest and lowest temperature, and the spray / irrigate / fertilise verdict for each day from the app rules.',
  },
  {
    name: 'get_my_season',
    description:
      "The farmer's active crop season: crop, sowing date, day number of the crop, current stage and next step from the crop calendar.",
  },
  {
    name: 'get_my_money',
    description:
      "Costs, sales and sales-minus-costs recorded by the farmer for the active crop season, or for the latest season of a named crop.",
    parameters: {
      type: 'OBJECT',
      properties: {
        crop: { type: 'STRING', description: 'Optional crop name (English or Bangla), e.g. "potato" or "আলু". Leave empty for the active season.' },
      },
    },
  },
  {
    name: 'get_market_price',
    description:
      "Today's price range for a crop or food item from the government DAM daily price bulletin, with the bulletin date. Says when the item is not in the bulletin.",
    parameters: {
      type: 'OBJECT',
      properties: {
        crop: { type: 'STRING', description: 'Crop or item name in English or Bangla, e.g. "onion" or "পেঁয়াজ".' },
      },
      required: ['crop'],
    },
  },
  {
    name: 'get_area_warnings',
    description:
      "Crop problems reported by 3 or more farmers in the farmer's upazila in the last 14 days, and the local sale price farmers reported for the main crop.",
  },
  {
    name: 'get_open_tasks',
    description: "The farmer's open and overdue tasks and reminders, soonest first.",
  },
  {
    name: 'lookup_disease',
    description:
      "The app's Bangladesh crop-disease reference: symptoms, look-alikes and general management for a disease name. No doses.",
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Disease name in English or Bangla, e.g. "late blight" or "মড়ক".' },
        crop: { type: 'STRING', description: 'Optional crop name to narrow the search.' },
      },
      required: ['name'],
    },
  },
];

export const TOOL_NAMES = TOOL_DECLARATIONS.map((d) => d.name);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const argText = (v: unknown, max = 60): string =>
  typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max) : '';

const T = FARM_THRESHOLDS;
export const REASON_EXPLANATION: Record<string, string> = {
  rain_likely: `rain is likely (${T.RAIN_LIKELY}% or more)`,
  rain_possible: `some chance of rain (${T.RAIN_POSSIBLE}% or more)`,
  wind_strong: `wind too strong (over ${T.WIND_TOO_STRONG} km/h)`,
  wind_breezy: `breezy (over ${T.WIND_BREEZY} km/h); pick a calm time`,
  too_hot: `too hot (over ${T.TOO_HOT_TO_SPRAY} °C); early morning or late afternoon`,
  low_risk: 'rain and wind risk are low',
  rain_unlikely: 'rain is unlikely',
  soil_wet: 'the soil is already wet',
  soil_dry: 'the soil is dry and no rain is expected',
  check_soil: 'no clear soil reading; check the soil by hand',
  no_data: 'a needed reading is missing; look at the sky',
};

const actionView = (a: FarmAction) => ({
  kind: a.kind,
  status: a.status,
  reason: a.reason,
  why: REASON_EXPLANATION[a.reason] ?? a.reason,
});

const CROP_ALIASES: Record<string, string> = {
  rice: 'paddy',
  paddy: 'paddy',
  dhan: 'paddy',
  'ধান': 'paddy',
  'চাল': 'paddy',
  chilli: 'chili',
  chili: 'chili',
  'green chilli': 'chili',
  'কাঁচা মরিচ': 'chili',
  egg: 'egg',
  eggs: 'egg',
  'ডিম': 'egg',
  garlic: 'garlic',
  'রসুন': 'garlic',
  ginger: 'ginger',
  'আদা': 'ginger',
  lentil: 'lentil',
  dal: 'lentil',
  'ডাল': 'lentil',
  'মসুর': 'lentil',
  eggplant: 'brinjal',
  aubergine: 'brinjal',
  pulse: 'pulse',
  'betel leaf': 'betel_leaf',
  'পান': 'betel_leaf',
  miniket: 'paddy',
  'মিনিকেট': 'paddy',
  chicken: 'chicken',
  'মুরগি': 'chicken',
  'মুরগী': 'chicken',
  beef: 'beef',
  'গরুর মাংস': 'beef',
  'মাংস': 'beef',
  sugar: 'sugar',
  'চিনি': 'sugar',
  'soybean oil': 'soybean_oil',
  'soyabean oil': 'soybean_oil',
  'সয়াবিন তেল': 'soybean_oil',
  'mug dal': 'mug_dal',
  'mung dal': 'mug_dal',
  'মুগ ডাল': 'mug_dal',
};

/** A crop name in English, Bangla or as an app id, as one canonical key ('paddy_boro' -> 'paddy'). */
export const canonicalCrop = (raw: unknown): string => {
  const s = argText(raw, 60).toLowerCase();
  if (!s) return '';
  if (CROP_ALIASES[s]) return CROP_ALIASES[s];
  const main = MAIN_CROPS.find((c) => c.id === s || c.en.toLowerCase() === s || c.bn.normalize('NFC') === s);
  if (main) return main.id;
  if (s.startsWith('paddy') || s.endsWith(' rice') || s.includes('ধান')) return 'paddy';
  return calendarKeyFor(s) ?? s.replace(/\s+/g, '_');
};

const cropNames = (key: string): { en: string | null; bn: string | null } => {
  const main = MAIN_CROPS.find((c) => c.id === key);
  return { en: main?.en ?? cropDisplayName(key), bn: main?.bn ?? null };
};

const hasBangla = (s: string): boolean => /[ঀ-৿]/.test(s);

// ---------------------------------------------------------------------------
// Location and weather
// ---------------------------------------------------------------------------

export type ResolvedLocation = { lat: number; lon: number; from: 'request' | 'farm_profile' } | null;

export const resolveLocation = (ctx: Pick<AssistantToolContext, 'location' | 'facts'>): ResolvedLocation => {
  if (ctx.location && isNum(ctx.location.lat) && isNum(ctx.location.lon)) {
    return { lat: roundCoord(ctx.location.lat), lon: roundCoord(ctx.location.lon), from: 'request' };
  }
  const loc = ctx.facts.profile?.location;
  if (loc && isNum(loc.latitude) && isNum(loc.longitude)) {
    return { lat: roundCoord(loc.latitude), lon: roundCoord(loc.longitude), from: 'farm_profile' };
  }
  return null;
};

const LOCATION_UNKNOWN: ToolResult = {
  source: 'app_data',
  status: 'location_unknown',
  note: 'The farm location is not known, so the weather and the spray / irrigate / fertilise advice cannot be checked. Ask the farmer to set their area in the profile or allow location, or to look at the Home screen.',
};

const TODAY_NOTE =
  "The app's rules decided these verdicts; they are the same as the Home screen. Explain them, never change them. Missing numbers are null (unknown), not zero.";

const weatherView = (c: TodayConditions) => ({
  tempC: numOrNull(c.temp),
  rainChanceRestOfTodayPct: numOrNull(c.rainChanceToday),
  rainChanceNext12hPct: numOrNull(c.rainChanceNext12h),
  windKmh: numOrNull(c.windSpeed),
  humidityPct: numOrNull(c.humidity),
  soilMoisture: numOrNull(c.soilMoisture),
});

const feedProvider = (feed: any): string | null => {
  const p = feed?.provider ?? feed?.dataSource?.name ?? null;
  return typeof p === 'string' ? p.slice(0, 60) : null;
};

// ---------------------------------------------------------------------------
// Money for a named crop
// ---------------------------------------------------------------------------

interface SeasonDoc {
  id: string;
  data: Record<string, unknown>;
}

const LINES_PAGE = 300;

const listDocs = async (
  call: AssistantToolDeps['adminFetch'],
  path: string,
  pageSize: number,
  signal: AbortSignal
): Promise<{ docs: SeasonDoc[]; more: boolean }> => {
  const response = await call(`${path}?pageSize=${pageSize}`, { signal });
  if (response.status === 404) return { docs: [], more: false };
  if (!response.ok) throw new Error(`list_${response.status}`);
  const body: any = await response.json().catch(() => null);
  const docs: SeasonDoc[] = [];
  for (const d of Array.isArray(body?.documents) ? body.documents : []) {
    const id = String(d?.name || '').split('/').pop() || '';
    if (id) docs.push({ id, data: fromFirestoreDocument(d) });
  }
  return { docs, more: typeof body?.nextPageToken === 'string' && body.nextPageToken.length > 0 };
};

const isPositive = (v: unknown): v is number => isNum(v) && v > 0;

const readSeasonMoney = async (call: AssistantToolDeps['adminFetch'], uid: string, seasonId: string, signal: AbortSignal) => {
  const base = `/documents/users/${encodeURIComponent(uid)}/seasons/${encodeURIComponent(seasonId)}`;
  const [expenses, sales] = await Promise.all([
    listDocs(call, `${base}/expenses`, LINES_PAGE, signal),
    listDocs(call, `${base}/sales`, LINES_PAGE, signal),
  ]);
  const costs = expenses.docs.filter((d) => isPositive(d.data.amount));
  const sold = sales.docs.filter((d) => isPositive(d.data.quantityMon) && isPositive(d.data.pricePerMon));
  const totals = seasonTotals(
    costs.map((d) => ({ amount: d.data.amount as number })),
    sold.map((d) => ({ quantityMon: d.data.quantityMon as number, pricePerMon: d.data.pricePerMon as number }))
  );
  const byCategory = new Map<string, number>();
  for (const d of costs) {
    const category = typeof d.data.category === 'string' ? d.data.category : 'other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + (d.data.amount as number));
  }
  const labels = EXPENSE_CATEGORY_LABELS as Record<string, { en: string }>;
  return {
    currency: 'BDT',
    costTotal: costs.length > 0 ? totals.costTotal : null,
    costCount: costs.length,
    salesTotal: sold.length > 0 ? totals.revenue : null,
    soldMon: sold.length > 0 ? totals.soldMon : null,
    profit: totals.profit,
    topCategories: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([category, amount]) => ({ category, label: labels[category]?.en ?? 'Other', amount })),
    ...(expenses.more || sales.more ? { incomplete: true } : {}),
  };
};

const moneyNotes = {
  noCosts: 'No cost recorded is NOT zero spending: the farmer has not noted any.',
  profit: 'profit = recorded sales minus recorded costs, a running figure, not a forecast; null until there is at least one of each.',
};

// ---------------------------------------------------------------------------
// Market price
// ---------------------------------------------------------------------------

/** Bulletin names (Bangla) that answer a crop. Earlier, more exact names first. */
const BULLETIN_NEEDLES: Record<string, string[]> = {
  paddy: ['চাল'],
  onion: ['পেঁয়াজ'],
  chili: ['কাঁচা মরিচ'],
  garlic: ['রসুন'],
  ginger: ['আদা'],
  egg: ['ডিম'],
  lentil: ['ডাল'],
  potato: ['আলু'],
  tomato: ['টমেটো'],
  brinjal: ['বেগুন'],
};

/**
 * Crop key -> the Market screen's commodity ids (`COMMODITY_MATCHERS` /
 * `NOT_IN_BULLETIN` in market-prices.ts), so the assistant names the same
 * bulletin line, with the same label, as the Market screen.
 */
const CROP_COMMODITIES: Record<string, string[]> = {
  paddy: ['dinajpur_rice', 'kushtia_miniket'],
  onion: ['faridpur_onion'],
  chili: ['pabna_chili'],
  egg: ['dhaka_egg'],
  garlic: ['natore_garlic'],
  ginger: ['ctg_ginger'],
  chicken: ['dhaka_chicken'],
  beef: ['dhaka_beef'],
  sugar: ['sugar'],
  soybean_oil: ['soybean_oil'],
  mug_dal: ['mug_dal'],
  tomato: ['cb_tomato'],
  potato: ['munshiganj_potato'],
  brinjal: ['jessore_brinjal'],
};

export interface MarketMatch {
  /** The Market screen's matches for this crop, first, with their labels. */
  primary: Array<{ id: string; label: string; item: BulletinItem }>;
  /** Other bulletin lines whose name contains the crop, after the primary ones. */
  extra: BulletinItem[];
  /** Set when the Market screen lists this crop as not in the bulletin (`NOT_IN_BULLETIN`). */
  notInBulletin: { id: string; label: string } | null;
}

/** The bulletin lines for a crop, the Market screen's own match first. At most 4 lines in all. */
export const matchMarket = (items: BulletinItem[], crop: string, raw: string): MarketMatch => {
  const ids = new Set(CROP_COMMODITIES[crop] ?? []);
  const asked = raw.trim().toLowerCase();
  const { matched } = matchCommodities(items);
  const missing = NOT_IN_BULLETIN;
  const primary: MarketMatch['primary'] = [];
  for (const m of matched) {
    if (!m.found || !m.item) continue;
    // By crop key, or by the screen's own label ("Fine Rice (Miniket)", "Green Chilli").
    const byLabel = asked.length >= 3 && m.label.toLowerCase().includes(asked);
    if (ids.has(m.id) || byLabel) primary.push({ id: m.id, label: m.label, item: m.item });
  }
  const missingEntry =
    missing.find((m) => ids.has(m.id)) ??
    (asked.length >= 3 ? missing.find((m) => m.label.toLowerCase() === asked) : undefined) ??
    null;
  if (primary.length === 0 && missingEntry) return { primary: [], extra: [], notInBulletin: missingEntry };
  const taken = new Set(primary.map((p) => p.item));
  const extra = findBulletinItems(items, crop, raw).filter((i) => !taken.has(i));
  return { primary: primary.slice(0, 4), extra: extra.slice(0, Math.max(0, 4 - primary.length)), notInBulletin: null };
};

export const findBulletinItems = (items: BulletinItem[], crop: string, raw: string): BulletinItem[] => {
  const needles = new Set<string>(BULLETIN_NEEDLES[crop] ?? []);
  const bn = cropNames(crop).bn;
  if (bn) needles.add(bn);
  if (hasBangla(raw)) needles.add(raw);
  const found: BulletinItem[] = [];
  for (const needle of [...needles].map((n) => n.normalize('NFC'))) {
    for (const item of items) {
      if (item.name.normalize('NFC').includes(needle) && !found.includes(item)) found.push(item);
    }
  }
  return found.slice(0, 4);
};

// ---------------------------------------------------------------------------
// Disease reference
// ---------------------------------------------------------------------------

export const findDiseases = (name: string, crop: string) => {
  const q = name.toLowerCase();
  if (q.length < 2) return [];
  const out: Array<{ crop: string; d: (typeof CROP_KNOWLEDGE)[string]['diseases'][number] }> = [];
  for (const [cropKey, entry] of Object.entries(CROP_KNOWLEDGE)) {
    if (crop && canonicalCrop(cropKey) !== crop) continue;
    for (const d of entry.diseases) {
      const en = d.disease.toLowerCase();
      const bn = d.diseaseBn.normalize('NFC');
      if (en.includes(q) || q.includes(en) || bn.includes(name) || name.includes(bn)) out.push({ crop: cropKey, d });
    }
  }
  return out.slice(0, 3);
};

// ---------------------------------------------------------------------------
// The runner
// ---------------------------------------------------------------------------

export const createAssistantTools = (ctx: AssistantToolContext): ToolRunner => {
  const { facts, deps, uid } = ctx;
  const now = deps.now ?? (() => new Date());
  const location = resolveLocation(ctx);
  const reading = ctx.reading ?? null;

  // One weather fetch per turn, shared by the today and week tools.
  let feedPromise: Promise<unknown> | null = null;
  const feed = (signal: AbortSignal) => {
    if (!location) return Promise.resolve(null);
    if (!feedPromise) {
      feedPromise = deps.fetchWeatherFeed(location.lat, location.lon, signal);
      // A failed fetch may be tried again by the next tool.
      feedPromise.catch(() => {
        feedPromise = null;
      });
    }
    return feedPromise;
  };
  const where = () => (location ? { lat: location.lat, lon: location.lon, from: location.from } : null);

  const executors: Record<string, (args: Record<string, unknown>, signal: AbortSignal) => Promise<ToolResult>> = {
    async get_today_farm_actions(_args, signal) {
      if (reading) {
        // The client's own reading: the same rules as Home, no fetch.
        const c: TodayConditions = {
          temp: reading.temp,
          humidity: reading.humidity,
          windSpeed: reading.windSpeed,
          rainChanceToday: reading.rainChanceToday,
          rainChanceNext12h: reading.rainChanceNext12h,
          soilMoisture: reading.soilMoisture,
        };
        return {
          source: 'rules',
          date: dhakaDay(new Date(reading.readingAt)),
          location: where(),
          actions: farmActions(todayActionInput(c)).map(actionView),
          weather: { ...weatherView(c), provider: null, readingAt: reading.readingAt },
          note: TODAY_NOTE,
        };
      }
      if (!location) return LOCATION_UNKNOWN;
      const f: any = await feed(signal);
      const actions = farmActionsFromFeed(f);
      const today = todayConditionsFromFeed(f);
      if (!actions || !today) throw new Error('no_current_reading');
      return {
        source: 'rules',
        date: typeof f?.current?.time === 'string' ? f.current.time.slice(0, 10) : dhakaDay(now()),
        location: where(),
        actions: actions.today.map(actionView),
        weather: { ...weatherView(today), provider: feedProvider(f) },
        note: TODAY_NOTE,
      };
    },

    async get_week_forecast(_args, signal) {
      if (!location) return LOCATION_UNKNOWN;
      const f: any = await feed(signal);
      const week = weekActionsFromFeed(f);
      if (week.length === 0) throw new Error('no_daily_forecast');
      return {
        source: 'weather_forecast',
        location: where(),
        provider: feedProvider(f),
        days: week.map((d) => ({
          date: d.date,
          rainChancePct: d.rainChance,
          tempMaxC: d.tempMax,
          tempMinC: d.tempMin,
          actions: d.actions.map((a) => ({ kind: a.kind, status: a.status, reason: a.reason })),
        })),
        note: 'Verdicts come from the app rules on each day\'s forecast. A day missing from the list has no usable forecast.',
      };
    },

    async get_my_season() {
      const s = facts.season;
      if (s === undefined) throw new Error('season_unknown');
      if (s === null) {
        return { source: 'farmer_records', season: null, note: 'No active crop season recorded (none started, or all harvested).' };
      }
      const key = canonicalCrop(s.crop);
      return {
        source: 'farmer_records',
        today: facts.today ?? dhakaDay(now()),
        season: {
          from: s.source,
          crop: s.crop,
          cropName: s.cropName ?? cropNames(key).en,
          cropNameBn: cropNames(key).bn,
          progress: s.progress ?? null,
          plotName: s.plotName ?? null,
          landSize: s.landSize ?? null,
          landUnit: s.landUnit ?? null,
          sowingDate: s.sowingDate ?? null,
          dayNumber: s.dayNumber ?? null,
          stageNow: s.calendarStage ?? null,
          nextStep: s.nextStep ?? null,
          calendarNote: s.calendarNote ?? null,
        },
        note: 'Day 1 is the sowing day. Stage and next step come from the general crop calendar (pending agronomist review).',
      };
    },

    async get_my_money(args, signal) {
      const asked = argText(args.crop);
      const wanted = canonicalCrop(asked);
      const season = facts.season;
      const activeKey = season ? canonicalCrop(season.crop) : '';
      if (!wanted || (season && wanted === activeKey)) {
        if (season === undefined || facts.money === undefined) throw new Error('money_unknown');
        if (!season || season.source !== 'season_record' || !facts.money) {
          return {
            source: 'farmer_records',
            found: false,
            note: 'No saved crop season to count costs and sales against. Costs and sales are unknown.',
          };
        }
        return {
          source: 'farmer_records',
          found: true,
          crop: season.crop,
          cropNameBn: cropNames(activeKey).bn,
          active: true,
          money: facts.money,
          notes: moneyNotes,
        };
      }

      // A different crop: an open (not harvested) season of it first, then the newest.
      const { docs } = await listDocs(deps.adminFetch, `/documents/users/${encodeURIComponent(uid)}/seasons`, 50, signal);
      const matches = docs.filter((d) => canonicalCrop(d.data.crop) === wanted);
      const stamp = (d: SeasonDoc) => String(d.data.updatedAt ?? d.data.createdAt ?? d.data.sowingDate ?? '');
      const closed = (d: SeasonDoc) => (d.data.stage === 'harvested' ? 1 : 0);
      matches.sort((a, b) => closed(a) - closed(b) || stamp(b).localeCompare(stamp(a)) || a.id.localeCompare(b.id));
      const pick = matches[0];
      if (!pick) {
        return {
          source: 'farmer_records',
          found: false,
          crop: asked,
          note: 'No season of this crop is recorded, so its costs and sales are unknown.',
        };
      }
      return {
        source: 'farmer_records',
        found: true,
        crop: typeof pick.data.crop === 'string' ? pick.data.crop.slice(0, 40) : wanted,
        cropNameBn: cropNames(wanted).bn,
        active: pick.data.stage !== 'harvested',
        sowingDate: typeof pick.data.sowingDate === 'string' ? pick.data.sowingDate.slice(0, 10) : null,
        money: await readSeasonMoney(deps.adminFetch, uid, pick.id, signal),
        notes: moneyNotes,
      };
    },

    async get_market_price(args, signal) {
      const asked = argText(args.crop);
      if (!asked) return { source: 'govt_bulletin', found: false, note: 'No crop named. Ask which crop.' };
      const key = canonicalCrop(asked);
      const bulletin = await deps.getBulletin(signal);
      const match = matchMarket(bulletin.items ?? [], key, asked.normalize('NFC'));
      const date = typeof bulletin.fetchedAt === 'string' && bulletin.fetchedAt ? dhakaDay(new Date(bulletin.fetchedAt)) : null;
      const base = {
        source: 'govt_bulletin' as const,
        bulletin: 'Department of Agricultural Marketing (DAM) daily price bulletin',
        date,
        stale: !!bulletin.stale,
        crop: asked,
      };
      if (match.notInBulletin) {
        return {
          ...base,
          found: false,
          notInBulletin: match.notInBulletin,
          // The Market screen lists these as missing; same label, same meaning.
          note: `${match.notInBulletin.label} is NOT in today's bulletin (the DAM daily bulletin does not carry it), so do not present any figure as official. Say so clearly and do not guess a price; suggest the local market or the Market screen.`,
        };
      }
      if (match.primary.length === 0 && match.extra.length === 0) {
        return {
          ...base,
          found: false,
          note: `"${asked}" is not in today's government bulletin. Say so clearly and do not guess a price; suggest the local market or the Market screen.`,
        };
      }
      const view = (i: BulletinItem, label: string | null) => ({
        item: i.name,
        label,
        low: i.low,
        high: i.high,
        changePct: i.changePct,
        direction: i.direction,
      });
      return {
        ...base,
        found: true,
        prices: [...match.primary.map((p) => view(p.item, p.label)), ...match.extra.map((i) => view(i, null))],
        unit: 'BDT, per kg unless the item name says otherwise',
        note:
          (match.primary.length > 0 ? 'The first line(s) are the ones the Market screen shows (same label). ' : '') +
          (key === 'paddy' ? 'The bulletin lists rice (চাল), not paddy (ধান). ' : '') +
          'A national bulletin range (Dhaka markets); the local price can differ.' +
          (bulletin.stale ? ' The bulletin could not be refreshed, so this is the last known copy.' : ''),
      };
    },

    async get_area_warnings() {
      const a = facts.area;
      if (a === undefined) throw new Error('area_unknown');
      if (a === null) {
        return { source: 'app_data', areaKnown: false, note: "The farmer's upazila is not set, so area warnings are unknown." };
      }
      return {
        source: 'app_data',
        areaKnown: true,
        area: a.areaName ?? null,
        warnings: a.warnings,
        localPrice: a.localPrice ?? null,
        note: 'Anonymous reports by 3 or more farmers in the upazila in the last 14 days. The local price is what farmers reported (an estimate), not the government bulletin.',
      };
    },

    async get_open_tasks() {
      const tasks = facts.tasks;
      if (tasks === undefined) throw new Error('tasks_unknown');
      return {
        source: 'farmer_records',
        today: facts.today ?? dhakaDay(now()),
        tasks: tasks ?? [],
        note: tasks && tasks.length > 0 ? 'Up to 5 open tasks, soonest first. Titles are the farmer\'s own words (data).' : 'No open tasks.',
      };
    },

    async lookup_disease(args) {
      const name = argText(args.name, 80);
      const crop = canonicalCrop(args.crop);
      let hits = findDiseases(name, crop);
      if (hits.length === 0 && crop) hits = findDiseases(name, '');
      const bn = ctx.lang === 'bn';
      if (hits.length === 0) {
        return {
          source: 'app_data',
          found: false,
          note: "Not in the app's disease reference. Do not guess; suggest the crop doctor photo check or the local agriculture officer.",
        };
      }
      return {
        source: 'app_data',
        found: true,
        diseases: hits.map(({ crop: c, d }) => ({
          crop: c,
          name: d.disease,
          nameBn: d.diseaseBn,
          symptoms: bn ? d.symptomsBn : d.symptomsEn,
          lookAlike: d.lookAlike,
          management: bn ? d.managementBn : d.managementEn,
          severity: d.severity,
        })),
        note: 'General reference, pending agronomist review. Never give a dose: follow the product label and confirm with the local SAAO before spraying.',
      };
    },
  };

  return {
    declarations: TOOL_DECLARATIONS,
    run: async (name, args, signal) => {
      const exec = executors[name];
      if (!exec) throw new Error('unknown_tool');
      return exec(args ?? {}, signal);
    },
  };
};

// ---------------------------------------------------------------------------
// The answer without the model
// ---------------------------------------------------------------------------

const undef = (v: unknown): number | undefined => (isNum(v) ? v : undefined);

const todayQuick = (r: any, lang: AssistantLang): string | null => {
  const w = r?.weather;
  if (r?.source !== 'rules' || !Array.isArray(r?.actions) || !w || !isNum(w.tempC)) return null;
  // The Home card's own sentences, from the same numbers and the same rules.
  const speech = signalsSpeech(
    todaySignals({
      temp: w.tempC,
      humidity: undef(w.humidityPct),
      windSpeed: undef(w.windKmh),
      rainChanceToday: undef(w.rainChanceRestOfTodayPct),
      rainChanceNext12h: undef(w.rainChanceNext12hPct),
      soilMoisture: undef(w.soilMoisture),
    }),
    lang
  );
  return lang === 'bn' ? `অ্যাপের নিয়ম অনুযায়ী আজ: ${speech}` : `By the app's rules, today: ${speech}`;
};

const marketQuick = (r: any, lang: AssistantLang): string | null => {
  if (r?.source !== 'govt_bulletin') return null;
  const bn = lang === 'bn';
  if (r.notInBulletin && typeof r.notInBulletin.label === 'string') {
    const name = bn ? cropNames(canonicalCrop(r.crop)).bn ?? String(r.crop ?? '') : r.notInBulletin.label;
    return bn
      ? `${name} আজকের সরকারি দৈনিক বাজারদর বুলেটিনে নেই, তাই সরকারি দাম বলা যাচ্ছে না। স্থানীয় বাজারে খোঁজ নিন।`
      : `${name} is not in today's government daily price bulletin, so there is no official price. Please check your local market.`;
  }
  if (r.found !== true || !Array.isArray(r.prices) || r.prices.length === 0) return null;
  const lines = r.prices.slice(0, 2).map((p: any) => {
    const name = bn ? String(p.item) : String(p.label ?? p.item);
    return bn ? `${name}: ৳${p.low}–${p.high}` : `${name}: Tk ${p.low}–${p.high}`;
  });
  const date = typeof r.date === 'string' ? r.date : null;
  if (bn) {
    return `সরকারি বাজারদর বুলেটিন (কৃষি বিপণন অধিদপ্তর${date ? `, ${date}` : ''}), প্রতি কেজি: ${lines.join('; ')}। এটি ঢাকার বাজারের দাম, স্থানীয় দাম আলাদা হতে পারে।${r.stale ? ' বুলেটিন নতুন করে আনা যায়নি, এটি শেষ জানা দাম।' : ''}`;
  }
  return `Government price bulletin (DAM${date ? `, ${date}` : ''}), per kg: ${lines.join('; ')}. These are Dhaka market prices; your local price can differ.${r.stale ? ' The bulletin could not be refreshed, so this is the last known copy.' : ''}`;
};

/**
 * A short fixed answer from the tool results, for when the model cannot finish
 * (`quickAnswer` in assistant-core.ts). Today's verdicts first, then the
 * market price; null when neither tool returned data.
 */
export const quickAnswerFromTools = (
  results: Array<{ name: string; result: ToolResult }>,
  lang: AssistantLang
): string | null => {
  const parts: string[] = [];
  for (const r of results) {
    if (r.name === 'get_today_farm_actions') {
      const t = todayQuick(r.result, lang);
      if (t) {
        parts.push(t);
        break;
      }
    }
  }
  for (const r of results) {
    if (r.name === 'get_market_price') {
      const m = marketQuick(r.result, lang);
      if (m) {
        parts.push(m);
        break;
      }
    }
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
};
