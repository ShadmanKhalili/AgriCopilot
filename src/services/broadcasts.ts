/**
 * Admin broadcasts: short messages shown in the app to every signed-in farmer
 * in one district (or everywhere) until a chosen day. Farmers read them with
 * `fetchBroadcasts` in `areaReports.ts`. These are shown inside the app only;
 * no phone notification is sent.
 *
 * The saved document has exactly the 7 fields that `firestore.rules` allows.
 * Nothing here throws: every function returns a result object.
 */

import { auth } from '../firebase';
import { slug, type Broadcast } from '../../netlify/functions/_shared/area-model';
import { addDaysToDateString, dhakaDateString } from '../utils/farmTaskDates';

export const BROADCAST_MAX_LENGTH = 500;
export const BROADCAST_MAX_DAYS = 30;
const LIST_LIMIT = 20;

export interface BroadcastInput {
  messageBn: string;
  messageEn: string;
  /** A district name or slug, or 'all'. */
  district: string;
  severity: 'info' | 'warning';
  /** The last day the message shows, 'YYYY-MM-DD' (Dhaka date). */
  expiresDay: string;
}

export type BroadcastError =
  | 'message_bn_empty'
  | 'message_bn_too_long'
  | 'message_en_empty'
  | 'message_en_too_long'
  | 'district_invalid'
  | 'severity_invalid'
  | 'expiry_invalid'
  | 'expiry_out_of_range'
  | 'signed_out';

export type BuildResult = { ok: true; broadcast: Broadcast } | { ok: false; error: BroadcastError };

/** Check the form values and shape the document. Pure: no network, no clock of its own. */
export const buildBroadcast = (input: BroadcastInput, uid: string, now: Date = new Date()): BuildResult => {
  if (!uid) return { ok: false, error: 'signed_out' };

  const messageBn = String(input?.messageBn ?? '').trim();
  const messageEn = String(input?.messageEn ?? '').trim();
  if (!messageBn) return { ok: false, error: 'message_bn_empty' };
  if (messageBn.length > BROADCAST_MAX_LENGTH) return { ok: false, error: 'message_bn_too_long' };
  if (!messageEn) return { ok: false, error: 'message_en_empty' };
  if (messageEn.length > BROADCAST_MAX_LENGTH) return { ok: false, error: 'message_en_too_long' };

  const rawDistrict = String(input?.district ?? '').trim();
  const district = rawDistrict.toLowerCase() === 'all' ? 'all' : slug(rawDistrict);
  if (!district) return { ok: false, error: 'district_invalid' };

  const severity = input?.severity;
  if (severity !== 'info' && severity !== 'warning') return { ok: false, error: 'severity_invalid' };

  const expiresDay = String(input?.expiresDay ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresDay) || addDaysToDateString(expiresDay, 0) !== expiresDay) {
    return { ok: false, error: 'expiry_invalid' };
  }
  const today = dhakaDateString(now);
  if (expiresDay < today || expiresDay > addDaysToDateString(today, BROADCAST_MAX_DAYS)) {
    return { ok: false, error: 'expiry_out_of_range' };
  }

  return {
    ok: true,
    broadcast: {
      messageBn,
      messageEn,
      district,
      severity,
      createdAt: now.toISOString(),
      expiresDay,
      createdBy: uid,
    },
  };
};

/** The last day to show a message that should run for `days` days, counting today. */
export const expiryForDays = (days: number, now: Date = new Date()): string =>
  addDaysToDateString(dhakaDateString(now), Math.min(BROADCAST_MAX_DAYS, Math.max(1, Math.trunc(days) || 1)) - 1);

export type CreateBroadcastResult =
  | { ok: true; id: string }
  | { ok: false; error: BroadcastError | 'failed' | 'permission_denied' };

/** Save one broadcast. Never throws. */
export const createBroadcast = async (input: BroadcastInput): Promise<CreateBroadcastResult> => {
  const built = buildBroadcast(input, auth.currentUser?.uid ?? '');
  if (built.ok === false) return { ok: false, error: built.error };
  try {
    const [{ addDoc, collection }, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
    const ref = await addDoc(collection(db, 'broadcasts'), built.broadcast);
    return { ok: true, id: ref.id };
  } catch (error) {
    console.warn('[Broadcasts] broadcast was not saved:', error);
    const code = (error as { code?: string } | null)?.code;
    return { ok: false, error: code === 'permission-denied' ? 'permission_denied' : 'failed' };
  }
};

export type StoredBroadcastRow = Broadcast & { id: string };

export type ListBroadcastsResult = { ok: true; items: StoredBroadcastRow[] } | { ok: false };

/** The 20 newest broadcasts, expired ones included. Never throws. */
export const listRecentBroadcasts = async (): Promise<ListBroadcastsResult> => {
  if (!auth.currentUser) return { ok: false };
  try {
    const [{ collection, getDocs, limit, orderBy, query }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../firestore'),
    ]);
    const snapshot = await getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)));
    return { ok: true, items: snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Broadcast) })) };
  } catch (error) {
    console.warn('[Broadcasts] list could not be read:', error);
    return { ok: false };
  }
};

export type DeleteBroadcastResult = { ok: true } | { ok: false; error: 'failed' | 'permission_denied' };

/** Delete one broadcast. Never throws. */
export const deleteBroadcast = async (id: string): Promise<DeleteBroadcastResult> => {
  if (!id) return { ok: false, error: 'failed' };
  try {
    const [{ deleteDoc, doc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
    await deleteDoc(doc(db, 'broadcasts', id));
    return { ok: true };
  } catch (error) {
    console.warn('[Broadcasts] broadcast was not deleted:', error);
    const code = (error as { code?: string } | null)?.code;
    return { ok: false, error: code === 'permission-denied' ? 'permission_denied' : 'failed' };
  }
};

/** Whether a stored broadcast has passed its last day. */
export const isExpired = (item: Pick<Broadcast, 'expiresDay'>, now: Date = new Date()): boolean =>
  item.expiresDay < dhakaDateString(now);
