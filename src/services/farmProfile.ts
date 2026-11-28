/**
 * The farmer's onboarding answers (language, district/upazila, main crop,
 * saved position, crop plan) mirrored into their account at
 * `users/{uid}/farm_profile/main`.
 *
 * Why: the answers live in browser storage only, so a server job (the daily
 * briefing, the assistant) cannot personalise for the farmer, and a new phone
 * starts from nothing. The Firestore rules enforce exactly the shape built by
 * `toFarmProfileDoc`, so keep the two in step.
 *
 * Firestore is imported lazily, like the other services, so guests who never
 * sign in do not download the SDK.
 */

import type { CropPlan } from '../utils/cropCalendar';

export const FARM_PROFILE_SCHEMA_VERSION = 1;

/** Place as kept in the app settings (and in the document). */
export interface FarmProfilePlace {
  district: string;
  districtBn: string;
  upazila?: string;
  upazilaBn?: string;
}

export interface FarmProfileLocation {
  latitude: number;
  longitude: number;
}

/** The document as the rules accept it, without the server-set `updatedAt`. */
export interface FarmProfileDoc {
  schemaVersion: 1;
  lang: 'bn' | 'en';
  mainCrop: string | null;
  place: FarmProfilePlace | null;
  location: FarmProfileLocation | null;
  cropPlan: CropPlan | null;
}

/** What the device holds; every part may be missing or malformed. */
export interface LocalFarmSettings {
  lang?: unknown;
  mainCrop?: unknown;
  place?: unknown;
  location?: unknown;
  cropPlan?: unknown;
}

/** Bangladesh bounds the rules accept for a saved position. */
export const PROFILE_BOUNDS = { minLat: 20.5, maxLat: 26.7, minLon: 88.0, maxLon: 92.7 };
export const MAX_COMPLETED_STAGES = 30;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** A trimmed string of 1..max characters, else null. */
const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : null;
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** True for a real calendar date written 'YYYY-MM-DD' (2026-02-31 is not). */
const isRealDate = (value: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
};

const cleanPlace = (value: unknown): FarmProfilePlace | null => {
  if (!isRecord(value)) return null;
  const district = text(value.district, 60);
  if (!district) return null;
  const place: FarmProfilePlace = { district, districtBn: text(value.districtBn, 60) ?? district };
  const upazila = text(value.upazila, 60);
  const upazilaBn = text(value.upazilaBn, 60);
  if (upazila) place.upazila = upazila;
  if (upazilaBn) place.upazilaBn = upazilaBn;
  return place;
};

const cleanLocation = (value: unknown): FarmProfileLocation | null => {
  if (!isRecord(value)) return null;
  const { latitude, longitude } = value;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const lat = round3(latitude);
  const lon = round3(longitude);
  const b = PROFILE_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lon < b.minLon || lon > b.maxLon) return null;
  return { latitude: lat, longitude: lon };
};

const cleanCropPlan = (value: unknown): CropPlan | null => {
  if (!isRecord(value)) return null;
  const cropKey = text(value.cropKey, 40);
  if (!cropKey) return null;
  if (typeof value.sowingDate !== 'string' || !isRealDate(value.sowingDate)) return null;
  if (!Array.isArray(value.completedStages)) return null;
  const stages = value.completedStages.filter(
    (n): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
  );
  const completedStages = Array.from(new Set(stages))
    .sort((a, b) => a - b)
    .slice(0, MAX_COMPLETED_STAGES);
  return { cropKey, sowingDate: value.sowingDate, completedStages };
};

/**
 * Pure: turn the device's settings into the document the rules accept.
 * Trims text, rounds the position to 3 decimals and turns any part that would
 * not pass (too long, outside Bangladesh, bad date) into null, so one bad
 * answer never blocks the rest. Keys are always in the same order, so the
 * JSON of two equal profiles is identical.
 */
export function toFarmProfileDoc(local: LocalFarmSettings): FarmProfileDoc {
  return {
    schemaVersion: FARM_PROFILE_SCHEMA_VERSION,
    lang: local.lang === 'en' ? 'en' : 'bn',
    mainCrop: text(local.mainCrop, 40),
    place: cleanPlace(local.place),
    location: cleanLocation(local.location),
    cropPlan: cleanCropPlan(local.cropPlan),
  };
}

/**
 * Pure and defensive: read a stored document (anything at all) back into the
 * same clean shape. Returns null when it is not an object, so callers can tell
 * "no usable profile" from "an empty profile".
 */
export function fromFarmProfileDoc(data: unknown): FarmProfileDoc | null {
  if (!isRecord(data)) return null;
  return toFarmProfileDoc({
    lang: data.lang,
    mainCrop: data.mainCrop,
    place: data.place,
    location: data.location,
    cropPlan: data.cropPlan,
  });
}

/** Stable string of a document, used to tell whether anything changed. */
export const farmProfileKey = (doc: FarmProfileDoc): string => JSON.stringify(doc);

/** True when the document holds any onboarding answer (place, crop or plan). */
export const hasOnboardingAnswers = (doc: Pick<FarmProfileDoc, 'place' | 'mainCrop' | 'cropPlan'>): boolean =>
  doc.place !== null || doc.mainCrop !== null || doc.cropPlan !== null;

export interface MergeOptions {
  /** Server values win over device values (a different account signed in). */
  serverWins?: boolean;
  /** Keep the device language. When false, the server language is used. Default true. */
  deviceLangChosen?: boolean;
}

/**
 * Pure: combine the device's profile with the server's, field by field
 * (mainCrop, place, location, cropPlan). The device value wins when both have
 * one, the server fills the gaps; with `serverWins` it is the other way round.
 * Fields are independent, so a crop plan without a main crop is fine.
 */
export function mergeFarmProfile(
  device: FarmProfileDoc,
  server: FarmProfileDoc | null,
  options: MergeOptions = {}
): FarmProfileDoc {
  if (!server) return device;
  const { serverWins = false, deviceLangChosen = true } = options;
  const pick = <T>(d: T | null, s: T | null): T | null => (serverWins ? s ?? d : d ?? s);
  return {
    schemaVersion: FARM_PROFILE_SCHEMA_VERSION,
    lang: deviceLangChosen ? device.lang : server.lang,
    mainCrop: pick(device.mainCrop, server.mainCrop),
    place: pick(device.place, server.place),
    location: pick(device.location, server.location),
    cropPlan: pick(device.cropPlan, server.cropPlan),
  };
}

/**
 * Pure: should the server profile win the first sync? Only when the local
 * answers were last synced with a different account and this account already
 * has a profile. An unknown previous account (first run) lets the device win.
 */
export const shouldServerWin = (lastSyncedUid: string | null, uid: string, serverExists: boolean): boolean =>
  serverExists && lastSyncedUid !== null && lastSyncedUid !== uid;

const SYNCED_UID_KEY = 'agricopilot.farmProfile.syncedUid';

/** The uid the local answers were last synced with, or null. Never throws. */
export function readSyncedUid(): string | null {
  try {
    return localStorage.getItem(SYNCED_UID_KEY);
  } catch {
    return null;
  }
}

export function writeSyncedUid(uid: string): void {
  try {
    localStorage.setItem(SYNCED_UID_KEY, uid);
  } catch {
    // storage unavailable: the device simply wins next time
  }
}

const loadFirestore = async () => {
  const [fs, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
  return { ...fs, db };
};

/**
 * Read the account's profile. Resolves null when there is none (or it is
 * unusable); rejects when it could not be read (offline, permission), so the
 * caller does not mistake a failed read for an empty server.
 */
export async function readFarmProfile(uid: string): Promise<FarmProfileDoc | null> {
  const { db, doc, getDoc } = await loadFirestore();
  const snap = await getDoc(doc(db, 'users', uid, 'farm_profile', 'main'));
  return snap.exists() ? fromFarmProfileDoc(snap.data()) : null;
}

/** Write the full document (not a merge), so its shape is always complete. */
export async function writeFarmProfile(uid: string, profile: FarmProfileDoc): Promise<void> {
  const { db, doc, setDoc, serverTimestamp } = await loadFirestore();
  await setDoc(doc(db, 'users', uid, 'farm_profile', 'main'), {
    ...profile,
    updatedAt: serverTimestamp(),
  });
}
