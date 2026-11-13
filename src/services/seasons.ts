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
 *              expectedPricePerMon, plannedCost, createdAt, updatedAt }
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

export const SEASON_LIMIT = 20;
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
  seasons: SeasonPlan[];
  expenses: Expense[];
}

const localId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

/** Rebuild a season from untrusted stored data; null when it is not one. */
export const parseSeason = (id: string, data: Record<string, unknown>): SeasonPlan | null => {
  const clean = normaliseSeasonInput(data as Partial<SeasonInput>);
  if (!clean || !id) return null;
  return {
    id,
    ...clean,
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

const writeLocalStore = (store: LocalStore): void => {
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

const seasonsCol = (uid: string) => collection(db, 'users', uid, 'seasons');
const expensesCol = (uid: string, seasonId: string) =>
  collection(db, 'users', uid, 'seasons', seasonId, 'expenses');

// ---------------------------------------------------------------------------
// The API the screens use. `uid` null means "this device only".
// ---------------------------------------------------------------------------

/** Saved plans, most recently changed first. */
export const listSeasons = async (uid: string | null): Promise<SeasonPlan[]> => {
  if (!uid) return sortSeasons(readLocalStore().seasons);
  const snap = await getDocs(query(seasonsCol(uid), where('uid', '==', uid), limit(SEASON_LIMIT)));
  const seasons = snap.docs
    .map((d) => parseSeason(d.id, d.data() as Record<string, unknown>))
    .filter((s): s is SeasonPlan => s !== null);
  return sortSeasons(seasons);
};

/**
 * Save a plan. With `existing` the plan is updated in place (same id and
 * creation time); otherwise a new plan is made.
 */
export const saveSeason = (
  uid: string | null,
  input: SeasonInput,
  existing?: Pick<SeasonPlan, 'id' | 'createdAt'> | null
): Pending<SeasonPlan> => {
  const clean = normaliseSeasonInput(input);
  if (!clean) throw new Error('seasons: the plan is not valid');
  const now = new Date().toISOString();

  if (!uid) {
    const item: SeasonPlan = {
      id: existing?.id ?? localId('season'),
      ...clean,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const store = readLocalStore();
    store.seasons = [item, ...store.seasons.filter((s) => s.id !== item.id)];
    writeLocalStore(store);
    return { item, saved: Promise.resolve() };
  }

  const ref = existing?.id ? doc(seasonsCol(uid), existing.id) : doc(seasonsCol(uid));
  const item: SeasonPlan = {
    id: ref.id,
    ...clean,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const { id: _id, ...fields } = item;
  const saved = setDoc(ref, { uid, ...fields });
  return { item, saved };
};

/** Delete a plan and every cost noted against it. */
export const deleteSeason = async (uid: string | null, seasonId: string): Promise<void> => {
  if (!seasonId) return;
  if (!uid) {
    const store = readLocalStore();
    store.seasons = store.seasons.filter((s) => s.id !== seasonId);
    store.expenses = store.expenses.filter((e) => e.seasonId !== seasonId);
    writeLocalStore(store);
    return;
  }
  const snap = await getDocs(
    query(expensesCol(uid, seasonId), where('uid', '==', uid), limit(EXPENSE_LIMIT))
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
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
