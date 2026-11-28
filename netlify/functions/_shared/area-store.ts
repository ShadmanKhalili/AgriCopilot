/**
 * Storage for area reports. Pure of any network code of its own: every
 * Firestore call goes through the injected `adminFetch`, so the tests can
 * run it against a fake database.
 *
 * Layout (see area-model.ts):
 *   area_raw/{areaKey}                  PRIVATE: every farmer's latest day and price, per problem / crop
 *   area_reporters/quota__{anonymousId} PRIVATE: {day, count}  (reports sent today)
 *   area_summaries/{areaKey}            signed-in read: aggregates of groups with 3+ farmers only
 *
 * A report is stored like this, as one optimistic transaction:
 *   1. Read the farmer's quota document and the area's raw document, each
 *      with its `updateTime`.
 *   2. If this farmer already reported this group today, stop (no rewrite).
 *      If this farmer has already sent the daily maximum, stop.
 *   3. Drop everything outside the 14-day window, add this report, and build
 *      the summary again from scratch, so a group that has fallen below 3
 *      farmers (or out of the window) disappears from the published summary.
 *   4. Commit the quota, the raw document and the summary in ONE
 *      `documents:commit`. The quota and the raw document carry a
 *      precondition on the `updateTime` read in step 1 (or "must not exist"),
 *      so when two reports arrive at the same moment, one is refused and
 *      starts again from step 1. The daily limit therefore cannot be
 *      overshot, and no report can overwrite another's.
 */

import {
  AREA_MAX_GROUPS,
  AREA_MIN_FARMERS,
  AREA_SUMMARY_VERSION,
  buildPublished,
  emptyRaw,
  farmersInGroup,
  groupKeyIn,
  pruneRaw,
  withReport,
  type AreaRaw,
  type CleanAreaReport,
} from './area-model.ts';
import { fromFirestoreDocument, toFirestoreValue } from './service-account.ts';

/** Most reports one farmer may send in a Dhaka day. */
export const MAX_REPORTS_PER_DAY = 20;
/** Times a report starts over when another report changed the same documents. */
export const MAX_ATTEMPTS = 5;

export interface AreaStoreDeps {
  /** Firestore REST as the service account; `path` starts after the database root. */
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Stable private code for a user (never the uid itself). */
  anonymousId: (uid: string) => string;
  /** Full resource name of a document, e.g. `projects/p/databases/d/documents/area_raw/x`. */
  documentName: (path: string) => string;
  /** Today in Dhaka, 'YYYY-MM-DD'. */
  today: string;
}

export type AreaStoreResult =
  | { status: 'stored'; farmers: number; crossedThreshold: boolean }
  | { status: 'repeat' }
  | { status: 'limited' };

const fail = (what: string, response: Response): never => {
  throw new Error(`area_store_${what}_${response.status}`);
};

const encode = (id: string): string => encodeURIComponent(id);

interface Loaded {
  data: Record<string, unknown> | null;
  /** The document's `updateTime`, or null when it does not exist yet. */
  updateTime: string | null;
}

const load = async (deps: AreaStoreDeps, collection: string, id: string): Promise<Loaded> => {
  const response = await deps.adminFetch(`/documents/${collection}/${encode(id)}`);
  if (response.status === 404) return { data: null, updateTime: null };
  if (!response.ok) return fail('read', response);
  const document: any = await response.json();
  return {
    data: fromFirestoreDocument(document),
    updateTime: typeof document?.updateTime === 'string' ? document.updateTime : null,
  };
};

const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

/** The raw document as a typed object. Anything that is not shaped as expected is ignored. */
export const parseRaw = (data: Record<string, unknown> | null): AreaRaw => {
  const raw = emptyRaw();
  if (!data) return raw;
  const reportersOf = (value: unknown) => {
    const out: Record<string, { day: string; pricePerMon?: number }> = {};
    for (const [who, entry] of Object.entries(record(value))) {
      const e = record(entry);
      if (typeof e.day !== 'string') continue;
      out[who] = { day: e.day, ...(typeof e.pricePerMon === 'number' ? { pricePerMon: e.pricePerMon } : {}) };
    }
    return out;
  };
  for (const [key, group] of Object.entries(record(data.problems))) {
    const g = record(group);
    raw.problems[key] = { crop: String(g.crop ?? ''), diseaseKey: String(g.diseaseKey ?? ''), reporters: reportersOf(g.reporters) };
  }
  for (const [key, group] of Object.entries(record(data.prices))) {
    const g = record(group);
    raw.prices[key] = { crop: String(g.crop ?? ''), reporters: reportersOf(g.reporters) };
  }
  return raw;
};

const fieldsOf = (data: Record<string, unknown>): Record<string, any> =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));

const precondition = (updateTime: string | null) => (updateTime ? { updateTime } : { exists: false });

/** True when Firestore refused a commit because another write got there first. */
const isConflict = async (response: Response): Promise<boolean> => {
  if (response.status === 409 || response.status === 412) return true;
  if (response.status !== 400) return false;
  try {
    const body: any = await response.clone().json();
    return body?.error?.status === 'FAILED_PRECONDITION';
  } catch {
    return false;
  }
};

/** Store one clean, validated report for this user. Throws when Firestore refuses. */
export const recordAreaReport = async (
  deps: AreaStoreDeps,
  report: CleanAreaReport,
  uid: string
): Promise<AreaStoreResult> => {
  const who = deps.anonymousId(uid);
  const today = deps.today;
  const key = groupKeyIn(report);
  if (!key) throw new Error('area_store_bad_key');
  const section = report.kind === 'problem' ? 'problems' : 'prices';
  const quotaId = `quota__${who}`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const [quota, rawDoc] = await Promise.all([
      load(deps, 'area_reporters', quotaId),
      load(deps, 'area_raw', report.areaKey),
    ]);

    // Already reported this group today: nothing to do.
    const raw = pruneRaw(parseRaw(rawDoc.data), today);
    const group = report.kind === 'problem' ? raw.problems[key] : raw.prices[key];
    if (group?.reporters?.[who]?.day === today) return { status: 'repeat' };

    // Daily maximum per farmer.
    const usedToday =
      quota.data && quota.data.day === today && typeof quota.data.count === 'number' ? quota.data.count : 0;
    if (usedToday >= MAX_REPORTS_PER_DAY) return { status: 'limited' };

    const farmersBefore = farmersInGroup(raw, report, today);

    // An area never holds more groups than this, whatever is sent.
    if (!group && Object.keys(raw[section]).length >= AREA_MAX_GROUPS) {
      return { status: 'stored', farmers: farmersBefore, crossedThreshold: false };
    }

    const next = withReport(raw, report, who, today);
    const farmersAfter = farmersInGroup(next, report, today);
    const published = buildPublished(next, today);

    const response = await deps.adminFetch('/documents:commit', {
      method: 'POST',
      body: JSON.stringify({
        writes: [
          {
            update: { name: deps.documentName(`area_reporters/${quotaId}`), fields: fieldsOf({ day: today, count: usedToday + 1 }) },
            currentDocument: precondition(quota.updateTime),
          },
          {
            update: { name: deps.documentName(`area_raw/${report.areaKey}`), fields: fieldsOf({ ...next, updatedAt: today }) },
            currentDocument: precondition(rawDoc.updateTime),
          },
          {
            // A whole-document replace: it also removes the fields of an older summary.
            update: {
              name: deps.documentName(`area_summaries/${report.areaKey}`),
              fields: fieldsOf({
                version: AREA_SUMMARY_VERSION,
                district: report.district,
                upazila: report.upazila,
                problems: published.problems,
                prices: published.prices,
                updatedAt: today,
              }),
            },
          },
        ],
      }),
    });
    if (response.ok) {
      return {
        status: 'stored',
        farmers: farmersAfter,
        crossedThreshold: report.kind === 'problem' && farmersBefore < AREA_MIN_FARMERS && farmersAfter >= AREA_MIN_FARMERS,
      };
    }
    if (await isConflict(response)) continue;
    return fail('commit', response);
  }
  throw new Error('area_store_conflict');
};
