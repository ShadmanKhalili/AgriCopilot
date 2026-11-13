/**
 * One shared Firestore listener for "my consultations" (farmer side).
 *
 * Expert Hub and the nav badge used to open their own listener on the same
 * query, so simply opening Expert Hub doubled the read cost of every
 * snapshot. This module owns a single, reference-counted listener and hands
 * the same list to every consumer.
 *
 * The listener is started when the first consumer mounts and stopped when the
 * last one unmounts.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import type { Consultation } from '../utils/expertTypes';

type Listener = (items: Consultation[]) => void;

let cachedItems: Consultation[] = [];
let activeFarmerId: string | null = null;
let unsubscribe: (() => void) | null = null;
const listeners = new Set<Listener>();
/** Bumped on every start and stop, so a late-loading start can tell it is stale. */
let listenToken = 0;

const stopListening = () => {
  listenToken += 1;
  unsubscribe?.();
  unsubscribe = null;
  activeFarmerId = null;
  cachedItems = [];
};

const startListening = (farmerId: string) => {
  // Already listening, or about to, for this farmer.
  if (activeFarmerId === farmerId) return;
  unsubscribe?.();
  unsubscribe = null;
  activeFarmerId = farmerId;
  cachedItems = [];
  const token = ++listenToken;
  // Loaded on demand so the database library is not part of the first load.
  import('../services/expertService')
    .then(({ watchFarmerConsultations }) => {
      if (token !== listenToken) return;
      unsubscribe = watchFarmerConsultations(farmerId, (items) => {
        cachedItems = items;
        listeners.forEach((listener) => listener(items));
      });
    })
    .catch((error) => {
      console.warn('Could not start the consultations listener:', error);
      if (token === listenToken) activeFarmerId = null;
    });
};

/**
 * Subscribe to the signed-in farmer's consultations.
 * Pass `false` to opt out (e.g. an expert who has no farmer-side cases).
 */
export function useFarmerConsultations(enabled = true): Consultation[] {
  const { user } = useAuth();
  const uid = user?.uid;
  const [items, setItems] = useState<Consultation[]>(cachedItems);

  useEffect(() => {
    if (!enabled || !uid) {
      setItems([]);
      return;
    }

    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    startListening(uid);
    listener(cachedItems);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stopListening();
    };
  }, [enabled, uid]);

  return items;
}
