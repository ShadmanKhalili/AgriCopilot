/**
 * Storage for area reports. Pure of any network code of its own: every
 * Firestore call goes through the injected `adminFetch`, so the tests can
 * run it against a fake database.
 *
 * Layout (see area-model.ts):
 *   area_reporters/{groupKey}__{anonymousId}   private: {groupKey, day, pricePerMon?}
 *   area_reporters/quota__{anonymousId}        private: {day, count}  (reports sent today)
 *   area_summaries/{areaKey}                   public to signed-in users: counts and prices only
 *
 * A report is stored in four steps:
 *   1. If this farmer already reported this group today, stop (no rewrite).
 *   2. If this farmer has already sent the daily maximum, stop.
 *   3. Write the farmer's reporter document (one per farmer per group, so a
 *      farmer who reports again only moves their own day forward).
 *   4. Read every reporter of the group, rebuild that one entry and patch it
 *      into the summary with an updateMask that names only that entry, so
 *      reports for other problems arriving at the same moment never overwrite
 *      each other.
 */

import {
  AREA_MIN_FARMERS,
  pricesFromReporters,
  problemFromReporters,
  problemKey,
  type CleanAreaReport,
  type ReporterEntry,
} from './area-model.ts';
import { fromFirestoreDocument, toFirestoreValue } from './service-account.ts';

/** Most reports one farmer may send in a Dhaka day. */
export const MAX_REPORTS_PER_DAY = 20;
/** Most reporter documents read for one group. */
export const MAX_REPORTERS_READ = 200;
/** Most problems (or most crops with prices) kept in one area's summary. */
export const MAX_SUMMARY_KEYS = 120;

export interface AreaStoreDeps {
  /** Firestore REST as the service account; `path` starts after the database root. */
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Stable private code for a user (never the uid itself). */
  anonymousId: (uid: string) => string;
  /** Today in Dhaka, 'YYYY-MM-DD'. */
  today: string;
  /** Overridable clock for `updatedAt`. */
  now?: () => Date;
}

export type AreaStoreResult =
  | { status: 'stored'; farmers: number; crossedThreshold: boolean }
  | { status: 'repeat' }
  | { status: 'limited' };

const SIMPLE_SEGMENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

/** A Firestore field path, backtick-quoting any segment that is not a plain identifier. */
export const fieldPath = (...segments: string[]): string =>
  segments
    .map((segment) =>
      SIMPLE_SEGMENT.test(segment) ? segment : `\`${segment.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``
    )
    .join('.');

const fail = (what: string, response: Response): never => {
  throw new Error(`area_store_${what}_${response.status}`);
};

const docPath = (collection: string, id: string): string => `/documents/${collection}/${encodeURIComponent(id)}`;

const getDoc = async (deps: AreaStoreDeps, collection: string, id: string): Promise<Record<string, unknown> | null> => {
  const response = await deps.adminFetch(docPath(collection, id));
  if (response.status === 404) return null;
  if (!response.ok) return fail('read', response);
  return fromFirestoreDocument(await response.json());
};

/** Create or replace a whole document. */
const putDoc = async (deps: AreaStoreDeps, collection: string, id: string, data: Record<string, unknown>) => {
  const response = await deps.adminFetch(docPath(collection, id), {
    method: 'PATCH',
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])),
    }),
  });
  if (!response.ok) fail('write', response);
};

/** Every reporter document of one group, with the document id of each. */
const readGroup = async (deps: AreaStoreDeps, groupKey: string): Promise<Array<{ id: string; entry: ReporterEntry }>> => {
  const response = await deps.adminFetch('/documents:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'area_reporters' }],
        where: {
          fieldFilter: { field: { fieldPath: 'groupKey' }, op: 'EQUAL', value: { stringValue: groupKey } },
        },
        limit: MAX_REPORTERS_READ,
      },
    }),
  });
  if (!response.ok) return fail('query', response);
  const rows: any[] = await response.json();
  const result: Array<{ id: string; entry: ReporterEntry }> = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.document) continue;
    const data = fromFirestoreDocument(row.document);
    if (typeof data.day !== 'string') continue;
    const id = String(row.document.name || '').split('/').pop() || '';
    result.push({
      id,
      entry: {
        day: data.day,
        ...(typeof data.pricePerMon === 'number' ? { pricePerMon: data.pricePerMon } : {}),
      },
    });
  }
  return result;
};

const countFarmers = (report: CleanAreaReport, entries: ReporterEntry[], today: string): number =>
  report.kind === 'problem'
    ? problemFromReporters(report, entries, today).reporterDays.length
    : pricesFromReporters(entries, today).length;

/** Store one clean report for this user. Throws when Firestore refuses. */
export const recordAreaReport = async (
  deps: AreaStoreDeps,
  report: CleanAreaReport,
  uid: string
): Promise<AreaStoreResult> => {
  const who = deps.anonymousId(uid);
  const reporterId = `${report.groupKey}__${who}`;
  const today = deps.today;

  // 1. Already reported this group today: nothing to do.
  const existing = await getDoc(deps, 'area_reporters', reporterId);
  if (existing && existing.day === today) return { status: 'repeat' };

  // 2. Daily maximum per farmer.
  const quotaId = `quota__${who}`;
  const quota = await getDoc(deps, 'area_reporters', quotaId);
  const usedToday = quota && quota.day === today && typeof quota.count === 'number' ? quota.count : 0;
  if (usedToday >= MAX_REPORTS_PER_DAY) return { status: 'limited' };

  // 3. This farmer's own entry.
  const own: ReporterEntry = { day: today, ...(report.kind === 'price' ? { pricePerMon: report.pricePerMon } : {}) };
  await putDoc(deps, 'area_reporters', reporterId, {
    groupKey: report.groupKey,
    day: today,
    ...(report.kind === 'price' ? { pricePerMon: report.pricePerMon } : {}),
  });
  await putDoc(deps, 'area_reporters', quotaId, { day: today, count: usedToday + 1 });

  // 4. Rebuild this one summary entry from everyone's reports.
  const group = await readGroup(deps, report.groupKey);
  const others = group.filter((row) => row.id !== reporterId).map((row) => row.entry);
  const before = existing
    ? [...others, { day: String(existing.day), ...(typeof existing.pricePerMon === 'number' ? { pricePerMon: existing.pricePerMon } : {}) }]
    : others;
  const after = [...others, own];
  const farmersBefore = countFarmers(report, before, today);
  const farmersAfter = countFarmers(report, after, today);

  const key = report.kind === 'problem' ? problemKey(report.crop, report.diseaseKey) : report.crop;
  if (!key) throw new Error('area_store_bad_key');
  const section = report.kind === 'problem' ? 'problems' : 'prices';

  // Keys come from what farmers send, so one area's summary could slowly
  // fill with made-up crops or problems. Past a cap, a new key is not added
  // (its private reporter entry is still kept); existing keys still update.
  const summary = await getDoc(deps, 'area_summaries', report.areaKey);
  const sectionMap = summary && typeof summary[section] === 'object' && summary[section] ? (summary[section] as Record<string, unknown>) : {};
  if (!(key in sectionMap) && Object.keys(sectionMap).length >= MAX_SUMMARY_KEYS) {
    return { status: 'stored', farmers: farmersAfter, crossedThreshold: false };
  }
  const value =
    report.kind === 'problem' ? problemFromReporters(report, after, today) : pricesFromReporters(after, today);

  const updatedAt = (deps.now ? deps.now() : new Date()).toISOString();
  const params = [fieldPath(section, key), 'district', 'upazila', 'updatedAt']
    .map((path) => `updateMask.fieldPaths=${encodeURIComponent(path)}`)
    .join('&');
  const response = await deps.adminFetch(`${docPath('area_summaries', report.areaKey)}?${params}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        district: toFirestoreValue(report.district),
        upazila: toFirestoreValue(report.upazila),
        updatedAt: toFirestoreValue(updatedAt),
        [section]: { mapValue: { fields: { [key]: toFirestoreValue(value) } } },
      },
    }),
  });
  if (!response.ok) fail('summary', response);

  return {
    status: 'stored',
    farmers: farmersAfter,
    crossedThreshold: report.kind === 'problem' && farmersBefore < AREA_MIN_FARMERS && farmersAfter >= AREA_MIN_FARMERS,
  };
};
