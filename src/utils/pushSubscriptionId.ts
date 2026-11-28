/**
 * Which `push_subscriptions` document a phone saves its subscription in.
 *
 * `firestore.rules` only accepts the ids `<uid>_0` to `<uid>_4`, so one
 * account can never hold more than five subscriptions. This picks the slot:
 * the one this phone already uses, else the first free one, else one chosen by
 * a hash of the endpoint (that replaces another of the account's phones, which
 * is the price of the cap).
 */

/** How many phones one account may keep notifications on. Mirrors firestore.rules. */
export const PUSH_SLOTS = 5;

/** The ids the rules accept for this account. */
export const pushSlotIds = (uid: string): string[] =>
  Array.from({ length: PUSH_SLOTS }, (_, slot) => `${uid}_${slot}`);

/** True when `id` is one of the account's allowed subscription ids. */
export const isPushSlotId = (uid: string, id: string): boolean => pushSlotIds(uid).includes(id);

/** A small, stable, non-cryptographic hash (FNV-1a). */
const hashText = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

export interface SavedSubscription {
  id: string;
  endpoint?: unknown;
}

/**
 * The document id to save `endpoint` under, given the account's own saved
 * subscriptions. Ids that are not one of the account's slots (the old
 * hash-based ids) are ignored here.
 */
export const pickSubscriptionId = (
  uid: string,
  endpoint: string,
  saved: SavedSubscription[]
): string => {
  const slots = pushSlotIds(uid);
  const inSlots = saved.filter((item) => slots.includes(item.id));

  const mine = inSlots.find((item) => item.endpoint === endpoint);
  if (mine) return mine.id;

  const taken = new Set(inSlots.map((item) => item.id));
  const free = slots.find((id) => !taken.has(id));
  if (free) return free;

  return slots[hashText(endpoint) % PUSH_SLOTS];
};
