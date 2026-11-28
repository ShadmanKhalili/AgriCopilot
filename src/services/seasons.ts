/**
 * A farmer's saved crop plans ("seasons") and the costs noted against them.
 *
 * Signed in:  users/{uid}/seasons/{seasonId}
 *             users/{uid}/seasons/{seasonId}/expenses/{expenseId}
 * Signed out: one JSON record in localStorage on this device.
 *
 * Firestore document shapes are fixed, because the security rules match
 * them exactly:
 *   season:  { uid, crop, landSize, landUnit, expectedYieldMon,
 *              expectedPricePerMon, plannedCost, createdAt, updatedAt,
 *              plotId?, stage?, sowingDate?, harvestDate?, harvestMon? }
 *            (the last five are Phase 7 progress; saving a plan must keep them)
 *   expense: { uid, seasonId, category, amount, note, date, createdAt }
 *
 * Writes return the stored item at once plus a `saved` promise. With the
 * offline cache a Firestore write can stay pending while the phone has no
 * signal, so the screen should not wait on it.
 *
 * This is the start of the farm record (Phase 7 builds plots, harvest and
 * sales on top of it).
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firestore';
import {
  normaliseExpenseInput,
  normaliseSeasonInput,
  sortExpenses,
  sortSeasons,
  EXPENSE_CATEGORIES,
  LAND_UNIT_DECIMALS,
  type Expense,
  type ExpenseInput,
  type SeasonInput,
  type SeasonPlan,
} from '../utils/seasonMath';
import { dhakaDateString } from '../utils/farmTaskDates';
import { cleanSeasonProgress, SALE_LIMIT, type SeasonProgress } from '../../netlify/functions/_shared/farm-record-model';

/** A season with the optional Phase 7 progress fields (plot, stage, dates, harvest). */
export type SeasonWithProgress = SeasonPlan & SeasonProgress;

/** Plans kept per farmer. Raised from 20 so a busy farmer's older plans are not silently dropped. */
export const SEASON_LIMIT = 100;
export const EXPENSE_LIMIT = 200;

export interface Pending<T> {
  item: T;
  /** Settles when the write is stored (Firestore) — already resolved for the device copy. */
  saved: Promise<void>;
}

// ---------------------------------------------------------------------------
// Device-only copy
// ---------------------------------------------------------------------------

export const LOCAL_SEASONS_KEY = 'krishi_seasons_v1';

interface LocalStore {
  seasons: SeasonWithProgress[];
  expenses: Expense[];
}

const localId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

/** Rebuild a season from untrusted stored data; null when it is not one. */
export const parseSeason = (id: string, data: Record<string, unknown>): SeasonWithProgress | null => {
  const clean = normaliseSeasonInput(data as Partial<SeasonInput>);
  if (!clean || !id) return null;
  return {
    id,
    ...clean,
    ...cleanSeasonProgress(data),
    createdAt: str(data.createdAt, 40),
    updatedAt: str(data.updatedAt, 40) || str(data.createdAt, 40),
  };
};

/** Rebuild a cost from untrusted stored data; null when it is not one. */
export const parseExpense = (id: string, data: Record<string, unknown>): Expense | null => {
  const seasonId = str(data.seasonId, 128);
  const date = str(data.date, 10);
  const clean = normaliseExpenseInput(data as Partial<ExpenseInput>, date || '1970-01-01');
  if (!clean || !id || !seasonId) return null;
  return { id, seasonId, ...clean, createdAt: str(data.createdAt, 40) };
};

export const readLocalStore = (): LocalStore => {
  try {
    const raw = window.localStorage.getItem(LOCAL_SEASONS_KEY);
    if (!raw) return { seasons: [], expenses: [] };
    const parsed = JSON.parse(raw);
    const seasons = Array.isArray(parsed?.seasons)
      ? parsed.seasons
          .map((s: any) => (s && typeof s === 'object' ? parseSeason(str(s.id, 128), s) : null))
          .filter(Boolean)
      : [];
    const expenses = Array.isArray(parsed?.expenses)
      ? parsed.expenses
          .map((e: any) => (e && typeof e === 'object' ? parseExpense(str(e.id, 128), e) : null))
          .filter(Boolean)
      : [];
    return { seasons, expenses };
  } catch {
    return { seasons: [], expenses: [] };
  }
};

export const writeLocalStore = (store: LocalStore): void => {
  try {
    window.localStorage.setItem(
      LOCAL_SEASONS_KEY,
      JSON.stringify({
        seasons: sortSeasons(store.seasons).slice(0, SEASON_LIMIT),
        expenses: store.expenses.slice(0, EXPENSE_LIMIT * SEASON_LIMIT),
      })
    );
  } catch {
    // Storage full or blocked. The screen keeps what it has in memory.
  }
};

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

/** Sales noted against seasons (Phase 7) are kept by `farmRecord.ts`; they go when their season goes. */
export const LOCAL_SALES_KEY = 'krishi_sales_v1';

const seasonsCol = (uid: string) => collection(db, 'users', uid, 'seasons');
const expensesCol = (uid: string, seasonId: string) =>
  collection(db, 'users', uid, 'seasons', seasonId, 'expenses');

// ---------------------------------------------------------------------------
// The API the screens use. `uid` null means "this device only".
// ---------------------------------------------------------------------------

/**
 * Saved plans, most recently changed first, and whether there are more than
 * `SEASON_LIMIT` (so the screen can say some are not shown).
 */
export const listSeasonsPage = async (
  uid: string | null
): Promise<{ seasons: SeasonWithProgress[]; truncated: boolean }> => {
  if (!uid) return { seasons: sortSeasons(readLocalStore().seasons), truncated: false };
  // Ask for one more than the limit: if it comes back, the list is cut short.
  const snap = await getDocs(query(seasonsCol(uid), where('uid', '==', uid), limit(SEASON_LIMIT + 1)));
  const truncated = snap.docs.length > SEASON_LIMIT;
  const seasons = snap.docs
    .slice(0, SEASON_LIMIT)
    .map((d) => parseSeason(d.id, d.data() as Record<string, unknown>))
    .filter((s): s is SeasonWithProgress => s !== null);
  return { seasons: sortSeasons(seasons), truncated };
};

/** Saved plans, most recently changed first. */
export const listSeasons = async (uid: string | null): Promise<SeasonWithProgress[]> =>
  (await listSeasonsPage(uid)).seasons;

/**
 * Save a plan. With `existing` the plan is updated in place (same id and
 * creation time); otherwise a new plan is made.
 *
 * Only the plan fields are written, and the Phase 7 progress fields (plot,
 * stage, dates, harvest) already on the season are kept: on the device by
 * carrying them over, in Firestore by merging.
 */
export const saveSeason = (
  uid: string | null,
  input: SeasonInput,
  existing?: (Pick<SeasonPlan, 'id' | 'createdAt'> & SeasonProgress) | null
): Pending<SeasonWithProgress> => {
  const clean = normaliseSeasonInput(input);
  if (!clean) throw new Error('seasons: the plan is not valid');
  const now = new Date().toISOString();

  if (!uid) {
    const store = readLocalStore();
    const stored = existing?.id ? store.seasons.find((s) => s.id === existing.id) : undefined;
    const item: SeasonWithProgress = {
      id: existing?.id ?? localId('season'),
      ...clean,
      ...cleanSeasonProgress(stored ?? existing),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    store.seasons = [item, ...store.seasons.filter((s) => s.id !== item.id)];
    writeLocalStore(store);
    return { item, saved: Promise.resolve() };
  }

  const ref = existing?.id ? doc(seasonsCol(uid), existing.id) : doc(seasonsCol(uid));
  const createdAt = existing?.createdAt ?? now;
  const item: SeasonWithProgress = {
    id: ref.id,
    ...clean,
    ...cleanSeasonProgress(existing),
    createdAt,
    updatedAt: now,
  };
  // Merge: only the plan fields are named here, so progress already stored stays.
  const saved = setDoc(ref, { uid, ...clean, createdAt, updatedAt: now }, { merge: true });
  return { item, saved };
};

/** Drop the device copy of the sales noted against a season that is being deleted. */
const removeLocalSales = (seasonId: string): void => {
  try {
    const raw = window.localStorage.getItem(LOCAL_SALES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.sales)) return;
    parsed.sales = parsed.sales.filter((sale: any) => sale?.seasonId !== seasonId);
    window.localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(parsed));
  } catch {
    // Nothing to clean up, or storage is blocked.
  }
};

/** Delete a plan and every cost noted against it. */
export const deleteSeason = async (uid: string | null, seasonId: string): Promise<void> => {
  if (!seasonId) return;
  if (!uid) {
    const store = readLocalStore();
    store.seasons = store.seasons.filter((s) => s.id !== seasonId);
    store.expenses = store.expenses.filter((e) => e.seasonId !== seasonId);
    writeLocalStore(store);
    removeLocalSales(seasonId);
    return;
  }
  const snap = await getDocs(
    query(expensesCol(uid, seasonId), where('uid', '==', uid), limit(EXPENSE_LIMIT))
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  const salesSnap = await getDocs(
    query(collection(db, 'users', uid, 'seasons', seasonId, 'sales'), where('uid', '==', uid), limit(SALE_LIMIT))
  );
  await Promise.all(salesSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(seasonsCol(uid), seasonId));
};

/** Costs noted against one plan, newest first. */
export const listExpenses = async (uid: string | null, seasonId: string): Promise<Expense[]> => {
  if (!seasonId) return [];
  if (!uid) {
    return sortExpenses(readLocalStore().expenses.filter((e) => e.seasonId === seasonId));
  }
  const snap = await getDocs(
    query(expensesCol(uid, seasonId), where('uid', '==', uid), limit(EXPENSE_LIMIT))
  );
  const list = snap.docs
    .map((d) => parseExpense(d.id, d.data() as Record<string, unknown>))
    .filter((e): e is Expense => e !== null);
  return sortExpenses(list);
};

/** Note one cost against a plan. */
export const addExpense = (
  uid: string | null,
  seasonId: string,
  input: Partial<ExpenseInput>
): Pending<Expense> => {
  const clean = normaliseExpenseInput(input, dhakaDateString());
  if (!seasonId || !clean) throw new Error('seasons: the cost is not valid');
  const createdAt = new Date().toISOString();

  if (!uid) {
    const item: Expense = { id: localId('cost'), seasonId, ...clean, createdAt };
    const store = readLocalStore();
    store.expenses = [item, ...store.expenses];
    writeLocalStore(store);
    return { item, saved: Promise.resolve() };
  }

  const ref = doc(expensesCol(uid, seasonId));
  const item: Expense = { id: ref.id, seasonId, ...clean, createdAt };
  const saved = setDoc(ref, {
    uid,
    seasonId,
    category: clean.category,
    amount: clean.amount,
    note: clean.note,
    date: clean.date,
    createdAt,
  });
  return { item, saved };
};

export const deleteExpense = async (
  uid: string | null,
  seasonId: string,
  expenseId: string
): Promise<void> => {
  if (!seasonId || !expenseId) return;
  if (!uid) {
    const store = readLocalStore();
    store.expenses = store.expenses.filter((e) => e.id !== expenseId);
    writeLocalStore(store);
    return;
  }
  await deleteDoc(doc(expensesCol(uid, seasonId), expenseId));
};

/** Exposed for the rules comment and tests: the allowed values. */
export const STORED_LAND_UNITS = Object.keys(LAND_UNIT_DECIMALS);
export const STORED_EXPENSE_CATEGORIES = [...EXPENSE_CATEGORIES];
