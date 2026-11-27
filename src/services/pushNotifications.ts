/**
 * Phone notifications, from the app's side.
 *
 * Turning them on asks the phone for permission, subscribes to the browser's
 * push service, and saves the subscription in `push_subscriptions/{id}` so the
 * server can send area warnings and the morning task reminder. Turning them
 * off removes both. Everything here returns a result object and never throws.
 *
 * Needs `VITE_VAPID_PUBLIC_KEY` (the public half of the server's VAPID key).
 */

import { auth } from '../firebase';
import { areaKey } from '../../netlify/functions/_shared/area-model';

export type PushLang = 'bn' | 'en';

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'not_configured' | 'signed_out' | 'denied' | 'failed' };

export type DisableResult = { ok: true } | { ok: false; reason: 'failed' };

export type PushPermission = 'unsupported' | 'default' | 'granted' | 'denied';

const COLLECTION = 'push_subscriptions';

const publicKey = (): string => {
  const value = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
  return typeof value === 'string' ? value.trim() : '';
};

/** True when the key the server needs to send is set for this build. */
export const isPushConfigured = (): boolean => publicKey().length > 0;

/** True when this browser can receive web push. */
export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** What the phone's settings say about notifications for this app. */
export const currentPermission = (): PushPermission =>
  isPushSupported() ? (Notification.permission as PushPermission) : 'unsupported';

const urlBase64ToBytes = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

/** Document id for one phone: the first 40 hex digits of the SHA-256 of its endpoint. */
const subscriptionId = async (endpoint: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40);
};

const currentSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

/** True when this phone has notifications allowed and a live subscription. */
export const isEnabled = async (): Promise<boolean> => {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  try {
    return (await currentSubscription()) !== null;
  } catch {
    return false;
  }
};

interface EnableInput {
  lang: PushLang;
  district?: string | null;
  upazila?: string | null;
}

const save = async (subscription: PushSubscription, uid: string, input: EnableInput): Promise<void> => {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const authSecret = json.keys?.auth;
  if (!json.endpoint || !p256dh || !authSecret) throw new Error('incomplete_subscription');

  const area = areaKey(input.district, input.upazila);
  const id = await subscriptionId(json.endpoint);
  const [{ doc, setDoc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
  await setDoc(doc(db, COLLECTION, id), {
    uid,
    endpoint: json.endpoint,
    p256dh,
    auth: authSecret,
    lang: input.lang === 'en' ? 'en' : 'bn',
    ...(area ? { areaKey: area } : {}),
    createdAt: new Date().toISOString(),
  });
};

/** Ask permission, subscribe, and save. Safe to call again to refresh the language or area. */
export const enableNotifications = async (input: EnableInput): Promise<EnableResult> => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const key = publicKey();
  if (!key) return { ok: false, reason: 'not_configured' };
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'signed_out' };

  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const registration = await navigator.serviceWorker.ready;
    const subscribe = () =>
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(key) as BufferSource,
      });

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await subscribe();
    try {
      await save(subscription, user.uid, input);
    } catch (firstError) {
      // The saved copy may belong to another account on this phone, or the
      // subscription may be stale. Start with a fresh one, once.
      await subscription.unsubscribe().catch(() => false);
      subscription = await subscribe();
      await save(subscription, user.uid, input);
    }
    return { ok: true };
  } catch (error) {
    console.warn('[Push] could not turn notifications on:', error instanceof Error ? error.name : 'error');
    return { ok: false, reason: 'failed' };
  }
};

/** Unsubscribe this phone and remove its saved subscription. */
export const disableNotifications = async (): Promise<DisableResult> => {
  if (!isPushSupported()) return { ok: true };
  try {
    const subscription = await currentSubscription();
    if (!subscription) return { ok: true };
    const id = await subscriptionId(subscription.endpoint);
    await subscription.unsubscribe();
    if (auth.currentUser) {
      try {
        const [{ doc, deleteDoc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
        await deleteDoc(doc(db, COLLECTION, id));
      } catch {
        // The server drops dead subscriptions the first time it tries one.
      }
    }
    return { ok: true };
  } catch (error) {
    console.warn('[Push] could not turn notifications off:', error instanceof Error ? error.name : 'error');
    return { ok: false, reason: 'failed' };
  }
};
