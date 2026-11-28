/**
 * The farm record from the app's side (Phase 7): plots, season progress and
 * sales. Costs and season plans stay in `seasons.ts`.
 *
 * Signed in:  users/{uid}/plots/{plotId}
 *             users/{uid}/seasons/{seasonId}             (progress fields merged in)
 *             users/{uid}/seasons/{seasonId}/sales/{saleId}
 *             farm_record_scores/{uid}                   (written by the server only)
 * Signed out: JSON records in localStorage on this device
 *             (`krishi_plots_v1`, `krishi_sales_v1`; plans and costs are in seasons.ts).
 *
 * `uid` null means "this device only" (signed out), exactly like seasons.ts.
 *
 * Writes return the stored item at once plus a `saved` promise (see `Pending`
 * in seasons.ts). Firestore is loaded on demand inside `saved`, so ids are made
 * here and the document is written a moment later.
 */

import { auth } from '../firebase';
import {
  cleanPlotInput,
  cleanSaleInput,
  CLEARABLE_PROGRESS_KEYS,
  cleanSeasonProgress,
seasonTotals,
  PLOT_LIMIT,
  RECORD_LEVEL_LABELS,
  RECORD_PILLAR_LABELS,
  SALE_LIMIT,
  type FarmRecordFacts,
  type Plot,
  type PlotInput,
  type RecordLevel,
  type RecordPillar,
  type RecordPillarKey,
  type Sale,
  type SaleInput,
  type SeasonProgress,
  type SeasonProgressChange,
  type SeasonTotals,
  type StoredRecordScore,
} from '../../netlify/functions/_shared/farm-record-model';
import { sortSeasons, type Expense, type SeasonPlan } from '../utils/seasonMath';
import { dhakaDateString } from '../utils/farmTaskDates';
import {
  LOCAL_SALES_KEY,
  listExpenses,
  listSeasons,
  readLocalStore,
  writeLocalStore,
  type Pending,
} from './seasons';

export type { Plot, PlotInput, Sale, SaleInput, SeasonProgress, SeasonProgressChange, SeasonTotals, StoredRecordScore };

/** A season with its Phase 7 progress, costs, sales and totals, ready to show. */
export interface SeasonRecord {
  season: SeasonPlan & SeasonProgress;
  expenses: Expense[];
  sales: Sale[];
  totals: SeasonTotals;
}

export interface FarmRecord {
  plots: Plot[];
  seasons: SeasonRecord[];
}

export const LOCAL_PLOTS_KEY = 'krishi_plots_v1';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A 20-character id like the ones Firestore makes; passes the rules' id check. */
const newId = (): string => {
  const bytes = new Uint8Array(20);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
};

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Firestore, loaded on demand so the database library stays out of the first load. */
const loadFirestore = async () => {
  const [fs, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
  return { ...fs, db };
};

const readKey = (key: string, field: string): unknown[] => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.[field]) ? parsed[field] : [];
  } catch {
    return [];
  }
};

const writeKey = (key: string, field: string, list: unknown[]): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify({ [field]: list }));
  } catch {
    // Storage full or blocked. The screen keeps what it has in memory.
  }
};

// ---------------------------------------------------------------------------
// Plots
// ---------------------------------------------------------------------------

/** Rebuild a plot from untrusted stored data; null when it is not one. */
export const parsePlot = (id: string, data: unknown): Plot | null => {
  if (!id || !isRecord(data)) return null;
  const clean = cleanPlotInput(data);
  if (!clean) return null;
  const createdAt = str(data.createdAt, 40);
  return { id, ...clean, createdAt, updatedAt: str(data.updatedAt, 40) || createdAt };
};

/** Oldest first, so the list does not jump around when a plot is edited. */
const sortPlots = (list: Plot[]): Plot[] =>
  [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

export const readLocalPlots = (): Plot[] =>
  readKey(LOCAL_PLOTS_KEY, 'plots')
    .map((p) => (isRecord(p) ? parsePlot(str(p.id, 128), p) : null))
    .filter((p): p is Plot => p !== null);

const writeLocalPlots = (plots: Plot[]): void => writeKey(LOCAL_PLOTS_KEY, 'plots', sortPlots(plots).slice(0, PLOT_LIMIT));

export const listPlots = async (uid: string | null): Promise<Plot[]> => {
  if (!uid) return sortPlots(readLocalPlots());
  const { collection, db, getDocs, limit, query, where } = await loadFirestore();
  const snap = await getDocs(query(collection(db, 'users', uid, 'plots'), where('uid', '==', uid), limit(PLOT_LIMIT)));
  return sortPlots(snap.docs.map((d) => parsePlot(d.id, d.data())).filter((p): p is Plot => p !== null));
};

/**
 * Create (no id) or update (id) a plot. Null when the input is not valid.
 * On the device a new plot is also refused once PLOT_LIMIT plots exist; for an
 * account the screen checks the count (it has the list).
 */
export const savePlot = (
  uid: string | null,
  input: PlotInput,
  id?: string,
  /** The plot being edited, if the screen has it: gives an account update the right createdAt in the item. */
  existing?: Pick<Plot, 'createdAt'> | null
): Pending<Plot> | null => {
  const clean = cleanPlotInput(input);
  if (!clean) return null;
  const now = new Date().toISOString();

  if (!uid) {
    const plots = readLocalPlots();
    const stored = id ? plots.find((p) => p.id === id) : undefined;
    if (id && !stored) return null;
    if (!stored && plots.length >= PLOT_LIMIT) return null;
    const item: Plot = {
      id: stored?.id ?? `plot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...clean,
      createdAt: stored?.createdAt ?? now,
      updatedAt: now,
    };
    writeLocalPlots([item, ...plots.filter((p) => p.id !== item.id)]);
    return { item, saved: Promise.resolve() };
  }

  if (id) {
    // An update changes only the named fields (the rules need createdAt kept),
    // and fails if the plot is gone instead of quietly creating a new one.
    const item: Plot = { id, ...clean, createdAt: existing?.createdAt || now, updatedAt: now };
    const saved = loadFirestore().then(({ db, doc, updateDoc }) =>
      updateDoc(doc(db, 'users', uid, 'plots', id), { ...clean, updatedAt: now })
    );
    return { item, saved };
  }
  const item: Plot = { id: newId(), ...clean, createdAt: now, updatedAt: now };
  const saved = loadFirestore().then(({ db, doc, setDoc }) =>
    setDoc(doc(db, 'users', uid, 'plots', item.id), { uid, ...clean, createdAt: now, updatedAt: now })
  );
  return { item, saved };
};

export const deletePlot = async (uid: string | null, plotId: string): Promise<void> => {
  if (!plotId) return;
  if (!uid) {
    writeLocalPlots(readLocalPlots().filter((p) => p.id !== plotId));
    return;
  }
  const { db, deleteDoc, doc } = await loadFirestore();
  await deleteDoc(doc(db, 'users', uid, 'plots', plotId));
};

// ---------------------------------------------------------------------------
// Season progress
// ---------------------------------------------------------------------------

/**
 * Set progress fields on an existing season, keeping its plan fields. Null
 * when no valid progress field was given (or, on the device, the season is gone).
 *
 * The returned item has the full season on the device. For an account the
 * plan fields are not known without a read, so pass the season you have as
 * `base` to get a full item back; without it the item holds only the id, the
 * progress fields and `updatedAt`, and the screen should merge it into its own copy.
 */
export const updateSeasonProgress = (
  uid: string | null,
  seasonId: string,
  progress: SeasonProgressChange,
  base?: (SeasonPlan & SeasonProgress) | null
): Pending<SeasonPlan & SeasonProgress> | null => {
  const clean = cleanSeasonProgress(progress);
  // Fields the farmer cleared (sent as null). Only the clearable keys count.
  const cleared = CLEARABLE_PROGRESS_KEYS.filter((key) => (progress as Record<string, unknown>)[key] === null);
  if (!seasonId || (Object.keys(clean).length === 0 && cleared.length === 0)) return null;
  const now = new Date().toISOString();
  const withoutCleared = <T extends object>(value: T): T => {
    const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const key of cleared) delete copy[key];
    return copy as T;
  };

  if (!uid) {
    const store = readLocalStore();
    const current = store.seasons.find((s) => s.id === seasonId);
    if (!current) return null;
    // Re-check the dates together with what is already stored.
    const kept = withoutCleared(current);
    const merged = cleanSeasonProgress({ ...kept, ...clean });
    const item = { ...kept, ...merged, updatedAt: now };
    store.seasons = [item, ...store.seasons.filter((s) => s.id !== seasonId)];
    writeLocalStore(store);
    return { item, saved: Promise.resolve() };
  }

  const item = withoutCleared({ ...(base ?? {}), id: seasonId, ...clean, updatedAt: now }) as SeasonPlan & SeasonProgress;
  // updateDoc touches only these fields, so the plan fields stay as they are.
  // A cleared field is removed with deleteField(); the rules check the result.
  const saved = loadFirestore().then(({ db, doc, updateDoc, deleteField }) => {
    const fields: Record<string, unknown> = { ...clean, updatedAt: now };
    for (const key of cleared) fields[key] = deleteField();
    return updateDoc(doc(db, 'users', uid, 'seasons', seasonId), fields);
  });
  return { item, saved };
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/** Rebuild a sale from untrusted stored data; null when it is not one. */
export const parseSale = (id: string, data: unknown): Sale | null => {
  if (!id || !isRecord(data)) return null;
  const seasonId = str(data.seasonId, 128);
  const date = str(data.date, 10);
  // Stored sales were checked when they were written; `date` is the only thing
  // compared with today, so use the stored one as "today" and check the rest.
  const clean = cleanSaleInput(data, date);
  if (!clean || !seasonId) return null;
  return { id, seasonId, ...clean, createdAt: str(data.createdAt, 40) };
};

/** Newest sale date first; createdAt breaks ties. */
const sortSales = (list: Sale[]): Sale[] =>
  [...list].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));

export const readLocalSales = (): Sale[] =>
  readKey(LOCAL_SALES_KEY, 'sales')
    .map((s) => (isRecord(s) ? parseSale(str(s.id, 128), s) : null))
    .filter((s): s is Sale => s !== null);

const writeLocalSales = (sales: Sale[]): void => writeKey(LOCAL_SALES_KEY, 'sales', sales);

export const listSales = async (uid: string | null, seasonId: string): Promise<Sale[]> => {
  if (!seasonId) return [];
  if (!uid) return sortSales(readLocalSales().filter((s) => s.seasonId === seasonId));
  const { collection, db, getDocs, limit, query, where } = await loadFirestore();
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'seasons', seasonId, 'sales'), where('uid', '==', uid), limit(SALE_LIMIT))
  );
  return sortSales(snap.docs.map((d) => parseSale(d.id, d.data())).filter((s): s is Sale => s !== null));
};

/**
 * Null when the input is not valid. On the device a season that already has
 * SALE_LIMIT sales is refused too; for an account the screen checks the count.
 */
export const addSale = (uid: string | null, seasonId: string, input: SaleInput): Pending<Sale> | null => {
  const clean = cleanSaleInput(input, dhakaDateString());
  if (!seasonId || !clean) return null;
  const createdAt = new Date().toISOString();

  if (!uid) {
    const all = readLocalSales();
    if (all.filter((s) => s.seasonId === seasonId).length >= SALE_LIMIT) return null;
    const item: Sale = {
      id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      seasonId,
      ...clean,
      createdAt,
    };
    writeLocalSales([item, ...all]);
    return { item, saved: Promise.resolve() };
  }

  const item: Sale = { id: newId(), seasonId, ...clean, createdAt };
  const saved = loadFirestore().then(({ db, doc, setDoc }) =>
    setDoc(doc(db, 'users', uid, 'seasons', seasonId, 'sales', item.id), {
      uid,
      seasonId,
      quantityMon: clean.quantityMon,
      pricePerMon: clean.pricePerMon,
      buyerType: clean.buyerType,
      date: clean.date,
      createdAt,
    })
  );
  return { item, saved };
};

export const deleteSale = async (uid: string | null, seasonId: string, saleId: string): Promise<void> => {
  if (!seasonId || !saleId) return;
  if (!uid) {
    writeLocalSales(readLocalSales().filter((s) => !(s.id === saleId && s.seasonId === seasonId)));
    return;
  }
  const { db, deleteDoc, doc } = await loadFirestore();
  await deleteDoc(doc(db, 'users', uid, 'seasons', seasonId, 'sales', saleId));
};

// ---------------------------------------------------------------------------
// The whole record
// ---------------------------------------------------------------------------

/** Everything the farm-record screen and the printed page need, in one call. */
export const loadFarmRecord = async (uid: string | null): Promise<FarmRecord> => {
  const [plots, seasons] = await Promise.all([listPlots(uid), listSeasons(uid)]);
  const plotIds = new Set(plots.map((p) => p.id));
  const records = await Promise.all(
    sortSeasons(seasons).map(async (raw): Promise<SeasonRecord> => {
      const [expenses, sales] = await Promise.all([listExpenses(uid, raw.id), listSales(uid, raw.id)]);
      // A plot that was deleted leaves the season unlinked, not pointing at nothing.
      const season = { ...raw };
      if (season.plotId && !plotIds.has(season.plotId)) delete season.plotId;
      return { season, expenses, sales, totals: seasonTotals(expenses, sales) };
    })
  );
  return { plots, seasons: records };
};

// ---------------------------------------------------------------------------
// The record score (calculated on the server)
// ---------------------------------------------------------------------------

export type RecordScoreResult =
  | { ok: true; score: StoredRecordScore }
  /** `not_configured`: the server has no service account yet. `too_soon`: asked again within 10 minutes. */
  | { ok: false; reason: 'signed_out' | 'not_configured' | 'too_soon' | 'failed' };

const count = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000) : 0;
};

/** Rebuild a stored score from untrusted data; null when it is not one. */
export const parseStoredScore = (data: unknown, fallbackUid = ''): StoredRecordScore | null => {
  if (!isRecord(data)) return null;
  const score = typeof data.score === 'number' ? data.score : NaN;
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  const level = data.level as RecordLevel;
  if (!(level in RECORD_LEVEL_LABELS)) return null;
  if (!Array.isArray(data.pillars)) return null;
  const pillars: RecordPillar[] = [];
  for (const raw of data.pillars) {
    if (!isRecord(raw) || !(raw.key as string in RECORD_PILLAR_LABELS)) continue;
    const max = count(raw.max);
    if (!max) continue;
    pillars.push({ key: raw.key as RecordPillarKey, points: Math.min(max, count(raw.points)), max });
  }
  if (pillars.length === 0) return null;
  const f = isRecord(data.facts) ? data.facts : {};
  const facts: FarmRecordFacts = {
    plots: count(f.plots),
    totalLandDecimals: count(f.totalLandDecimals),
    seasons: count(f.seasons),
    seasonsWithCosts: count(f.seasonsWithCosts),
    seasonsWithHarvest: count(f.seasonsWithHarvest),
    seasonsWithSales: count(f.seasonsWithSales),
    activeMonths: count(f.activeMonths),
    cropChecks: count(f.cropChecks),
  };
  return {
    uid: str(data.uid, 128) || fallbackUid,
    score: Math.round(score),
    level,
    pillars,
    facts,
    computedAt: str(data.computedAt, 50),
    version: count(data.version),
  };
};

/** The last score the server stored for this farmer, or null. Signed in only. */
export const fetchRecordScore = async (): Promise<StoredRecordScore | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    // Loaded on demand so the database library stays out of the first load.
    const [{ doc, getDoc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
    const snapshot = await getDoc(doc(db, 'farm_record_scores', user.uid));
    return snapshot.exists() ? parseStoredScore(snapshot.data(), user.uid) : null;
  } catch (error) {
    console.warn('[FarmRecord] the score could not be read:', error);
    return null;
  }
};

/** Ask the server to recalculate the score now. Never throws. */
export const refreshRecordScore = async (): Promise<RecordScoreResult> => {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'signed_out' };
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/farm-record-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}',
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429) return { ok: false, reason: 'too_soon' };
    if (response.status === 503) return { ok: false, reason: 'not_configured' };
    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'signed_out' };
    if (!response.ok) return { ok: false, reason: 'failed' };
    const body = await response.json();
    const score = parseStoredScore(body?.score, user.uid);
    return score ? { ok: true, score } : { ok: false, reason: 'failed' };
  } catch (error) {
    console.warn('[FarmRecord] the score was not recalculated:', error);
    return { ok: false, reason: 'failed' };
  }
};
