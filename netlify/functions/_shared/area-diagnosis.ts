/**
 * Checks that a farmer really ran a diagnosis for the problem they report.
 *
 * A problem report is accepted only when the same account has a saved
 * diagnosis (`diagnoses`, written by the app right before it sends the report)
 * with:
 *   - the same `diseaseKey` (e.g. `paddy:rice-blast`; this also fixes the crop),
 *   - the same district and upazila, and
 *   - a creation time inside the last 14 days.
 *
 * The creation time is the document's own `createTime`, which Firestore sets
 * and a farmer cannot choose. The `createdAt` field in the document is typed
 * by the app and is NOT used.
 *
 * The query is two equality filters (`userId`, `diseaseKey`), which Firestore
 * answers without a composite index.
 */

import { AREA_WINDOW_DAYS, slug } from './area-model.ts';
import { fromFirestoreDocument } from './service-account.ts';

export interface DiagnosisCheckDeps {
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Overridable clock. */
  now?: () => Date;
}

/** Most diagnoses of one disease read for one farmer. */
export const DIAGNOSIS_LIMIT = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A diagnosis cannot be created in the future; allow for a little clock difference. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * True when `uid` has a recent diagnosis of `diseaseKey` made in this district
 * and upazila (slugs). Throws when Firestore cannot be read.
 */
export const hasRecentDiagnosis = async (
  deps: DiagnosisCheckDeps,
  uid: string,
  diseaseKey: string,
  districtSlug: string,
  upazilaSlug: string
): Promise<boolean> => {
  const now = (deps.now ? deps.now() : new Date()).getTime();
  const response = await deps.adminFetch('/documents:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'diagnoses' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
              { fieldFilter: { field: { fieldPath: 'diseaseKey' }, op: 'EQUAL', value: { stringValue: diseaseKey } } },
            ],
          },
        },
        select: { fields: [{ fieldPath: 'district' }, { fieldPath: 'upazila' }] },
        limit: DIAGNOSIS_LIMIT,
      },
    }),
  });
  if (!response.ok) throw new Error(`area_diagnosis_query_${response.status}`);

  let rows: any;
  try {
    rows = await response.json();
  } catch {
    return false;
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    const document = row?.document;
    if (!document?.fields) continue;
    const createdMs = Date.parse(String(document.createTime ?? ''));
    if (!Number.isFinite(createdMs)) continue;
    if (createdMs < now - AREA_WINDOW_DAYS * DAY_MS || createdMs > now + CLOCK_SKEW_MS) continue;
    const data = fromFirestoreDocument(document);
    if (slug(data.district) === districtSlug && slug(data.upazila) === upazilaSlug) return true;
  }
  return false;
};
