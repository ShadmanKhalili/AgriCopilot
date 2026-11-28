/**
 * Area reports, from the app's side.
 *
 * Sending: the app tells the server "a farmer here saw this problem" or
 * "a farmer here got this price". The server checks the sign-in, the place,
 * crop and disease, and (for a problem) a recent diagnosis, and keeps the
 * per-farmer data private. Reading: the app reads the published summary for
 * the farmer's own upazila. The server publishes only groups of 3 or more
 * farmers, as counts and rounded prices; the app checks the same minimum
 * again before showing a warning or a local price (see `area-model.ts`).
 * Summaries in the older shape (without `version: 2`) are ignored.
 *
 * Everything here fails quietly: an area report is a courtesy to neighbours,
 * and must never block or break the farmer's own task.
 */

import { auth } from '../firebase';
import {
  AREA_SUMMARY_VERSION,
  activeBroadcasts,
  activeWarnings,
  areaKey,
  cleanAreaReport,
  localPrice,
  type AreaReportInput,
  type AreaSummary,
  type AreaWarning,
  type Broadcast,
  type LocalPrice,
} from '../../netlify/functions/_shared/area-model';
import { dhakaDateString } from '../utils/farmTaskDates';

export type { AreaWarning, LocalPrice, Broadcast };

export type AreaReportResult =
  | { ok: true }
  /** `not_configured`: the server has no service account yet. */
  | { ok: false; reason: 'signed_out' | 'invalid' | 'not_configured' | 'too_new' | 'failed' };

/** Send one anonymous report for the farmer's area. Never throws. */
export const sendAreaReport = async (input: AreaReportInput): Promise<AreaReportResult> => {
  if (!cleanAreaReport(input)) return { ok: false, reason: 'invalid' };
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'signed_out' };
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/area-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return { ok: true };
    if (response.status === 503) return { ok: false, reason: 'not_configured' };
    if (response.status === 400) return { ok: false, reason: 'invalid' };
    if (response.status === 403) {
      // 403 is a guest account (reports need a real account, or the 3-farmer
      // minimum could be faked with throwaway guests), an account made in the
      // last hour, or a problem with no matching recent diagnosis.
      const error = await response.json().then((body: any) => String(body?.error ?? ''), () => '');
      if (error === 'account_too_new') return { ok: false, reason: 'too_new' };
      if (error === 'no_recent_diagnosis') return { ok: false, reason: 'invalid' };
      return { ok: false, reason: 'signed_out' };
    }
    if (response.status === 401) return { ok: false, reason: 'signed_out' };
    return { ok: false, reason: 'failed' };
  } catch (error) {
    console.warn('[AreaReports] report was not sent:', error);
    return { ok: false, reason: 'failed' };
  }
};

/**
 * The published summary for one upazila, or null when there is none, it cannot
 * be read, or it is in an older shape (those held per-farmer data and are ignored).
 */
export const fetchAreaSummary = async (
  district: string | null | undefined,
  upazila: string | null | undefined
): Promise<AreaSummary | null> => {
  const key = areaKey(district, upazila);
  if (!key || !auth.currentUser) return null;
  try {
    // Loaded on demand so the database library stays out of the first load.
    const [{ doc, getDoc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
    const snapshot = await getDoc(doc(db, 'area_summaries', key));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as AreaSummary;
    return data?.version === AREA_SUMMARY_VERSION ? data : null;
  } catch (error) {
    console.warn('[AreaReports] summary could not be read:', error);
    return null;
  }
};

/** Warnings to show a farmer in this upazila today. Empty when there are none. */
export const fetchAreaWarnings = async (
  district: string | null | undefined,
  upazila: string | null | undefined
): Promise<AreaWarning[]> => activeWarnings(await fetchAreaSummary(district, upazila), dhakaDateString());

/** The local sale price for a crop, or null when fewer than 3 farmers reported one. */
export const fetchLocalPrice = async (
  district: string | null | undefined,
  upazila: string | null | undefined,
  crop: string
): Promise<LocalPrice | null> => localPrice(await fetchAreaSummary(district, upazila), crop, dhakaDateString());

export type StoredBroadcast = Broadcast & { id: string };

/** Admin messages a farmer in this district should see today. Empty when signed out. */
export const fetchBroadcasts = async (district: string | null | undefined): Promise<StoredBroadcast[]> => {
  if (!auth.currentUser) return [];
  try {
    const [{ collection, getDocs, limit, orderBy, query }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../firestore'),
    ]);
    const snapshot = await getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20)));
    const list = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Broadcast) }));
    return activeBroadcasts(list, district, dhakaDateString());
  } catch (error) {
    console.warn('[AreaReports] broadcasts could not be read:', error);
    return [];
  }
};
