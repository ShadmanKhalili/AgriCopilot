/**
 * Sending phone notifications (web push) from the server.
 *
 * Phones that agreed to notifications are stored in `push_subscriptions`
 * (see firestore.rules). This file finds the right ones, encrypts the message
 * for each (see web-push-crypto.ts) and hands it to the phone's push service.
 *
 * Rules kept here:
 *   - Never throws. A notification is a courtesy; callers carry on without it.
 *   - Never logs an endpoint or a key. Only counts are logged.
 *   - A push service that answers 404 or 410 says the phone has unsubscribed
 *     or the app was removed, so that subscription is deleted.
 *
 * Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT and the service
 * account (FIREBASE_SERVICE_ACCOUNT).
 */

import { adminFetch, fromFirestoreDocument, serviceAccountConfigured } from './service-account.ts';
import { buildPushRequest, readVapidKeys, type VapidKeys } from './web-push-crypto.ts';

export interface PushMessage {
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  /** Path to open when the notification is tapped, e.g. `/#community-radar`. */
  url: string;
  /** Notifications with the same tag replace each other on the phone. */
  tag?: string;
}

/** Most phones fetched for one send. */
const MAX_SUBSCRIPTIONS = 500;
/** Phones contacted at the same time. */
const CONCURRENCY = 10;
/** How long one push service may take to answer. */
const PUSH_TIMEOUT_MS = 8000;

/** True when the keys needed to send notifications are set on the server. */
export const pushConfigured = (): boolean => readVapidKeys() !== null && serviceAccountConfigured();

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: 'bn' | 'en';
}

/**
 * The endpoint is written by the phone's owner, so it could be any address.
 * The server only ever calls the browsers' own push services, never an
 * address a user chose (that would let anyone make the server send requests
 * to a site of their choice).
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
];

export const isPushServiceEndpoint = (endpoint: string): boolean => {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
};

const toSubscription = (row: any): Subscription | null => {
  const name = row?.document?.name;
  if (typeof name !== 'string') return null;
  const data = fromFirestoreDocument(row.document);
  const { endpoint, p256dh, auth } = data;
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (!isPushServiceEndpoint(endpoint)) return null;
  return {
    id: name.slice(name.lastIndexOf('/') + 1),
    endpoint,
    p256dh,
    auth,
    lang: data.lang === 'en' ? 'en' : 'bn',
  };
};

/** Subscriptions whose `field` equals `value`. Empty on any failure. */
const findSubscriptions = async (field: 'areaKey' | 'uid', value: string): Promise<Subscription[]> => {
  if (!value) return [];
  try {
    const response = await adminFetch('/documents:runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'push_subscriptions' }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
          limit: MAX_SUBSCRIPTIONS,
        },
      }),
    });
    if (!response.ok) {
      console.warn(`[push] subscription lookup failed (${response.status}).`);
      return [];
    }
    const rows: any = await response.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(toSubscription).filter((item): item is Subscription => item !== null);
  } catch {
    console.warn('[push] subscription lookup failed.');
    return [];
  }
};

const deleteSubscription = async (id: string): Promise<void> => {
  try {
    await adminFetch(`/documents/push_subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // The next send will try again.
  }
};

/** Send one notification to one phone. True when the push service accepted it. */
const sendOne = async (subscription: Subscription, message: PushMessage, keys: VapidKeys): Promise<boolean> => {
  try {
    const bn = subscription.lang === 'bn';
    const payload = JSON.stringify({
      title: bn ? message.titleBn : message.titleEn,
      body: bn ? message.bodyBn : message.bodyEn,
      url: message.url,
      tag: message.tag,
    });
    const request = buildPushRequest(subscription, payload, keys);
    const response = await fetch(request.url, {
      method: request.init.method,
      headers: request.init.headers,
      body: new Uint8Array(request.init.body),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) {
      await deleteSubscription(subscription.id);
      return false;
    }
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
};

const sendToAll = async (subscriptions: Subscription[], message: PushMessage): Promise<number> => {
  const keys = readVapidKeys();
  if (!keys || subscriptions.length === 0) return 0;
  let sent = 0;
  let next = 0;
  const worker = async () => {
    while (next < subscriptions.length) {
      const subscription = subscriptions[next++];
      if (await sendOne(subscription, message, keys)) sent += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, subscriptions.length) }, worker));
  return sent;
};

/**
 * Send a notification to every phone subscribed in one area.
 * Returns how many were sent. Never throws.
 */
export const sendPushToArea = async (areaKey: string, message: PushMessage): Promise<number> => {
  try {
    if (!pushConfigured() || !/^[a-z0-9_]+$/.test(areaKey || '')) return 0;
    return await sendToAll(await findSubscriptions('areaKey', areaKey), message);
  } catch {
    return 0;
  }
};

/**
 * Send a notification to every phone one user subscribed.
 * Returns how many were sent. Never throws.
 */
export const sendPushToUser = async (uid: string, message: PushMessage): Promise<number> => {
  try {
    if (!pushConfigured() || !uid) return 0;
    return await sendToAll(await findSubscriptions('uid', uid), message);
  } catch {
    return 0;
  }
};
