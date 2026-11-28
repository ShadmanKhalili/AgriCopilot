/**
 * Counts the facts the record score is calculated from, reading the farmer's
 * own documents with the service account (see service-account.ts). Every
 * Firestore call goes through the injected `adminFetch`, so the tests run it
 * against a fake database.
 *
 * Reads (all REST, no composite index needed):
 *   users/{uid}/plots                              list, page of 50
 *   users/{uid}/seasons                            list, page of 50
 *   users/{uid}/seasons/{id}/expenses and /sales   list, page of 300 each
 *   diagnoses                                      runQuery userId == uid, createdAt only, limit 500
 *
 * Everything is read defensively: a document that is not shaped as expected is
 * skipped, never counted and never fatal. A Firestore error is fatal and is
 * thrown with only a status code in its message (never a uid).
 */

import {
  LAND_UNITS,
  isDay,
  plotDecimals,
  type FarmRecordFacts,
  type LandUnit,
} from './farm-record-model.ts';
import { fromFirestoreDocument } from './service-account.ts';

export interface RecordFactsDeps {
  /** Firestore REST as the service account; `path` starts after the database root. */
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export const PLOTS_PAGE = 50;
export const SEASONS_PAGE = 50;
export const LINES_PAGE = 300;
export const DIAGNOSES_LIMIT = 500;
/** Seasons whose costs and sales are read at the same time. */
export const SEASON_CONCURRENCY = 5;
/** Costs a season needs before it counts as having its costs noted. */
export const MIN_COSTS_PER_SEASON = 3;

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** 'YYYY-MM' of an instant in Dhaka (UTC+6, no daylight saving). */
const dhakaMonth = (ms: number): string => new Date(ms + DHAKA_OFFSET_MS).toISOString().slice(0, 7);

/** The 12 calendar months ending with the one that holds `now` (Dhaka time). */
export const lastTwelveMonths = (now: Date): Set<string> => {
  const months = new Set<string>();
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  let year = dhaka.getUTCFullYear();
  let month = dhaka.getUTCMonth(); // 0-based
  for (let i = 0; i < 12; i += 1) {
    months.add(`${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`);
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return months;
};

const fail = (what: string, response: Response): never => {
  throw new Error(`record_facts_${what}_${response.status}`);
};

const seg = (value: string): string => encodeURIComponent(value);

/** The plain fields of every document in one list page. Documents without fields are skipped. */
const listDocuments = async (
  deps: RecordFactsDeps,
  path: string,
  pageSize: number,
  what: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> => {
  const response = await deps.adminFetch(`${path}?pageSize=${pageSize}`);
  // A collection nobody has written to answers 200 with no `documents`; a 404 is treated the same.
  if (response.status === 404) return [];
  if (!response.ok) return fail(what, response);
  let body: any;
  try {
    body = await response.json();
  } catch {
    return [];
  }
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const document of Array.isArray(body?.documents) ? body.documents : []) {
    if (!document || typeof document !== 'object' || !document.fields || typeof document.fields !== 'object') continue;
    const id = String(document.name || '').split('/').pop() || '';
    if (!id) continue;
    try {
      out.push({ id, data: fromFirestoreDocument(document) });
    } catch {
      // A document that cannot be read is skipped.
    }
  }
  return out;
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** An ISO timestamp (or a 'YYYY-MM-DD' day) as epoch milliseconds, or null. */
const toMs = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/** 'YYYY-MM' for a 'YYYY-MM-DD' farmer-typed date, or null when it is not a real-looking day. */
const monthOfDay = (value: unknown): string | null => (isDay(value) ? value.slice(0, 7) : null);

const readDiagnosisMonths = async (deps: RecordFactsDeps, uid: string): Promise<string[]> => {
  const response = await deps.adminFetch('/documents:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'diagnoses' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
        select: { fields: [{ fieldPath: 'createdAt' }] },
        limit: DIAGNOSES_LIMIT,
      },
    }),
  });
  if (!response.ok) return fail('diagnoses', response);
  let rows: any;
  try {
    rows = await response.json();
  } catch {
    return [];
  }
  const months: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.document?.fields) continue;
    const ms = toMs(fromFirestoreDocument(row.document).createdAt);
    if (ms === null) continue;
    months.push(dhakaMonth(ms));
  }
  return months;
};

interface SeasonFacts {
  hasCosts: boolean;
  hasHarvest: boolean;
  hasSales: boolean;
  /** Months (any, not yet filtered) in which this season has a cost or a sale. */
  months: string[];
}

const readSeason = async (
  deps: RecordFactsDeps,
  uid: string,
  seasonId: string,
  data: Record<string, unknown>
): Promise<SeasonFacts> => {
  const base = `/documents/users/${seg(uid)}/seasons/${seg(seasonId)}`;
  const [expenses, sales] = await Promise.all([
    listDocuments(deps, `${base}/expenses`, LINES_PAGE, 'expenses'),
    listDocuments(deps, `${base}/sales`, LINES_PAGE, 'sales'),
  ]);
  const months: string[] = [];
  let costCount = 0;
  for (const expense of expenses) {
    if (!isPositiveNumber(expense.data.amount)) continue;
    costCount += 1;
    const month = monthOfDay(expense.data.date);
    if (month) months.push(month);
  }
  let saleCount = 0;
  for (const sale of sales) {
    if (!isPositiveNumber(sale.data.quantityMon) || !isPositiveNumber(sale.data.pricePerMon)) continue;
    saleCount += 1;
    const month = monthOfDay(sale.data.date);
    if (month) months.push(month);
  }
  return {
    hasCosts: costCount >= MIN_COSTS_PER_SEASON,
    hasHarvest: isPositiveNumber(data.harvestMon),
    hasSales: saleCount >= 1,
    months,
  };
};

/**
 * Count what the record score needs for one farmer. Throws (message holds only
 * a status code) when Firestore refuses a read.
 */
export const gatherFarmRecordFacts = async (
  deps: RecordFactsDeps,
  uid: string,
  now: Date
): Promise<FarmRecordFacts> => {
  const window = lastTwelveMonths(now);

  const [plotDocs, seasonDocs, diagnosisMonths] = await Promise.all([
    listDocuments(deps, `/documents/users/${seg(uid)}/plots`, PLOTS_PAGE, 'plots'),
    listDocuments(deps, `/documents/users/${seg(uid)}/seasons`, SEASONS_PAGE, 'seasons'),
    readDiagnosisMonths(deps, uid),
  ]);

  let plots = 0;
  let totalLand = 0;
  for (const { data } of plotDocs) {
    const size = data.landSize;
    if (!isPositiveNumber(size) || !LAND_UNITS.includes(data.landUnit as LandUnit)) continue;
    plots += 1;
    totalLand += plotDecimals({ landSize: size, landUnit: data.landUnit as LandUnit });
  }

  const seasonResults: SeasonFacts[] = [];
  for (let i = 0; i < seasonDocs.length; i += SEASON_CONCURRENCY) {
    const chunk = seasonDocs.slice(i, i + SEASON_CONCURRENCY);
    seasonResults.push(...(await Promise.all(chunk.map((s) => readSeason(deps, uid, s.id, s.data)))));
  }

  const active = new Set<string>();
  for (const result of seasonResults) {
    for (const month of result.months) if (window.has(month)) active.add(month);
  }
  let cropChecks = 0;
  for (const month of diagnosisMonths) {
    if (!window.has(month)) continue;
    cropChecks += 1;
    active.add(month);
  }

  return {
    plots,
    totalLandDecimals: Math.round(totalLand * 100) / 100,
    seasons: seasonDocs.length,
    seasonsWithCosts: seasonResults.filter((s) => s.hasCosts).length,
    seasonsWithHarvest: seasonResults.filter((s) => s.hasHarvest).length,
    seasonsWithSales: seasonResults.filter((s) => s.hasSales).length,
    activeMonths: active.size,
    cropChecks,
  };
};
