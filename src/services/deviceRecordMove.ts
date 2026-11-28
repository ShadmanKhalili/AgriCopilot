/**
 * Move what a farmer saved on this phone (signed out) into their account
 * once they have one.
 *
 * The first AI request quietly signs the farmer in as a guest, so `uid` can
 * change from null to an account at any moment. From then on every screen
 * reads the account, and plans, costs, plots and sales kept on the phone would
 * vanish from view. This copies them across, keeping their ids, and clears the
 * phone copy only after the account has confirmed every write.
 *
 * Safe to run again: anything already in the account is skipped (costs and
 * sales cannot be overwritten under the rules). Costs and sales are written
 * after their season, because the rules check that the season exists.
 */

import { listExpenses, listSeasons, readLocalStore, LOCAL_SALES_KEY, LOCAL_SEASONS_KEY } from './seasons';
import { listPlots, listSales, readLocalPlots, readLocalSales, LOCAL_PLOTS_KEY } from './farmRecord';

/** Firestore allows 500 writes in one batch. */
const BATCH_SIZE = 400;

/** How long a screen waits for the move before it shows what the account has. */
export const MOVE_WAIT_MS = 6000;

type Write = { path: string[]; data: Record<string, unknown> };

const loadFirestore = async () => {
  const [fs, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
  return { ...fs, db };
};

const stamp = (value: string, fallback: string): string => (value ? value : fallback);

/** True when this phone holds a farm record that is not in an account yet. */
export const hasDeviceRecord = (): boolean => {
  const store = readLocalStore();
  return store.seasons.length > 0 || store.expenses.length > 0 || readLocalPlots().length > 0 || readLocalSales().length > 0;
};

const commitAll = async (writes: Write[]): Promise<void> => {
  if (writes.length === 0) return;
  const { db, doc, writeBatch } = await loadFirestore();
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + BATCH_SIZE)) {
      const [first, ...rest] = w.path;
      batch.set(doc(db, first, ...rest), w.data);
    }
    await batch.commit();
  }
};

const clearDevice = (): void => {
  try {
    window.localStorage.removeItem(LOCAL_SEASONS_KEY);
    window.localStorage.removeItem(LOCAL_PLOTS_KEY);
    window.localStorage.removeItem(LOCAL_SALES_KEY);
  } catch {
    // Storage blocked: the next run skips what the account already has.
  }
};

/** Copy the phone's record into the account. Resolves when every write is confirmed. */
export const moveDeviceRecordToAccount = async (uid: string): Promise<boolean> => {
  if (!uid || !hasDeviceRecord()) return false;
  const now = new Date().toISOString();
  const { seasons, expenses } = readLocalStore();
  const plots = readLocalPlots();
  const sales = readLocalSales();

  // 1. Plots and seasons the account does not have yet.
  const [accountPlots, accountSeasons] = await Promise.all([listPlots(uid), listSeasons(uid)]);
  const havePlot = new Set(accountPlots.map((p) => p.id));
  const haveSeason = new Set(accountSeasons.map((s) => s.id));
  const first: Write[] = [];
  for (const { id, createdAt, updatedAt, ...rest } of plots) {
    if (havePlot.has(id)) continue;
    const created = stamp(createdAt, now);
    first.push({ path: ['users', uid, 'plots', id], data: { uid, ...rest, createdAt: created, updatedAt: stamp(updatedAt, created) } });
  }
  for (const { id, createdAt, updatedAt, ...rest } of seasons) {
    if (haveSeason.has(id)) continue;
    const created = stamp(createdAt, now);
    first.push({ path: ['users', uid, 'seasons', id], data: { uid, ...rest, createdAt: created, updatedAt: stamp(updatedAt, created) } });
  }
  await commitAll(first);

  // 2. Costs and sales, for seasons that are now in the account.
  const seasonIds = new Set([...haveSeason, ...seasons.map((s) => s.id)]);
  const needed = [...new Set([...expenses.map((e) => e.seasonId), ...sales.map((s) => s.seasonId)])].filter((id) =>
    seasonIds.has(id)
  );
  const second: Write[] = [];
  for (const seasonId of needed) {
    const [haveExpenses, haveSales] = await Promise.all([listExpenses(uid, seasonId), listSales(uid, seasonId)]);
    const haveExpense = new Set(haveExpenses.map((e) => e.id));
    const haveSale = new Set(haveSales.map((s) => s.id));
    for (const e of expenses) {
      if (e.seasonId !== seasonId || haveExpense.has(e.id)) continue;
      second.push({
        path: ['users', uid, 'seasons', seasonId, 'expenses', e.id],
        data: { uid, seasonId, category: e.category, amount: e.amount, note: e.note, date: e.date, createdAt: stamp(e.createdAt, now) },
      });
    }
    for (const s of sales) {
      if (s.seasonId !== seasonId || haveSale.has(s.id)) continue;
      second.push({
        path: ['users', uid, 'seasons', seasonId, 'sales', s.id],
        data: {
          uid,
          seasonId,
          quantityMon: s.quantityMon,
          pricePerMon: s.pricePerMon,
          buyerType: s.buyerType,
          date: s.date,
          createdAt: stamp(s.createdAt, now),
        },
      });
    }
  }
  await commitAll(second);

  // Costs or sales whose season was never kept have nowhere to go; they are dropped with the rest.
  clearDevice();
  return true;
};

const running = new Map<string, Promise<boolean>>();

/**
 * Start (or join) the move for this account and wait for it, at most
 * MOVE_WAIT_MS. Never rejects: on failure or timeout the phone copy stays and
 * the next screen load tries again.
 */
export const withDeviceRecordMoved = async (uid: string | null, waitMs = MOVE_WAIT_MS): Promise<void> => {
  if (!uid) return;
  let job = running.get(uid);
  if (!job) {
    if (!hasDeviceRecord()) return;
    job = moveDeviceRecordToAccount(uid)
      .catch((error) => {
        console.warn('[farm record] could not move the phone record to the account', error?.code || error);
        return false;
      })
      .finally(() => running.delete(uid));
    running.set(uid, job);
  }
  await Promise.race([job, new Promise<void>((resolve) => setTimeout(resolve, waitMs))]);
};
