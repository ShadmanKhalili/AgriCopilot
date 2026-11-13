/**
 * Crop photos shared with a human expert.
 *
 * Same storage approach as voice notes: the image is base64 text inside a
 * Firestore document (no file storage product is set up). Each photo is its
 * own document at `consultations/{id}/photos/{p0|p1|p2}`, never on the
 * request document itself, so every photo stays far below the 1 MiB limit.
 *
 * Access mirrors messages and voice notes (see firestore.rules): the farmer
 * who owns the request can always read; the chosen expert can read only while
 * consent is valid and not revoked. Only the owning farmer can add a photo,
 * and only when they ticked "Crop photos" in the consent step. Photos are
 * never edited; the farmer may delete them.
 *
 * The fixed ids p0..p2 cap the count at 3 in the rules as well as here: a
 * write to an id that already exists would be an update, which is denied.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firestore';
import {
  MAX_PHOTOS_PER_REQUEST,
  PHOTO_MAX_BASE64_CHARS,
  PHOTO_MIME_TYPE,
  base64ByteLength,
  isValidBase64,
  type CompressedPhoto,
} from '../utils/imageCompress';

export const PHOTO_IDS = ['p0', 'p1', 'p2'] as const;
export type PhotoId = (typeof PHOTO_IDS)[number];

/** A photo upload that has not been confirmed by the server within this time counts as not sent. */
const UPLOAD_TIMEOUT_MS = 25_000;

export interface ConsultationPhoto {
  id: PhotoId;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  uploadedBy: string;
}

export interface PhotoUploadResult {
  /** Positions (0-based, in the order the farmer picked them) that are saved. */
  saved: number[];
  /** Positions that were not saved, with the error. */
  failed: { index: number; error: unknown }[];
}

const photosCol = (consultationId: string) => collection(db, 'consultations', consultationId, 'photos');

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('upload-timeout'), { code: 'unavailable' })), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/**
 * Save one photo into a fixed slot. Safe to call again for a retry: if the
 * slot already holds a photo (an earlier attempt reached the server, or is
 * queued on this device), it counts as saved instead of writing twice.
 */
export const uploadConsultationPhoto = async (
  consultationId: string,
  slot: number,
  photo: CompressedPhoto,
  uploaderId: string
): Promise<void> => {
  const photoId = PHOTO_IDS[slot];
  if (!photoId) throw new Error('too-many-photos');
  if (!isValidBase64(photo.base64) || photo.base64.length > PHOTO_MAX_BASE64_CHARS) {
    throw Object.assign(new Error('photo-too-large'), { code: 'invalid-argument' });
  }
  const ref = doc(db, 'consultations', consultationId, 'photos', photoId);
  const existing = await getDoc(ref).catch(() => null);
  if (existing?.exists()) return;
  await withTimeout(
    setDoc(ref, {
      base64: photo.base64,
      mimeType: PHOTO_MIME_TYPE,
      width: Math.round(photo.width),
      height: Math.round(photo.height),
      bytes: base64ByteLength(photo.base64),
      createdAt: new Date().toISOString(),
      uploadedBy: uploaderId,
    }),
    UPLOAD_TIMEOUT_MS
  );
};

/**
 * Upload the given photos (slot = position). Never throws: a failed photo must
 * not undo or block the request. The caller tells the farmer which failed.
 */
export const uploadConsultationPhotos = async (
  consultationId: string,
  photos: { slot: number; photo: CompressedPhoto }[],
  uploaderId: string
): Promise<PhotoUploadResult> => {
  const capped = photos.filter((p) => p.slot >= 0 && p.slot < MAX_PHOTOS_PER_REQUEST);
  const results = await Promise.allSettled(
    capped.map((p) => uploadConsultationPhoto(consultationId, p.slot, p.photo, uploaderId))
  );
  const outcome: PhotoUploadResult = { saved: [], failed: [] };
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') outcome.saved.push(capped[i].slot);
    else outcome.failed.push({ index: capped[i].slot, error: r.reason });
  });
  // Photos rejected before upload (slot out of range) are failures too.
  photos
    .filter((p) => !capped.includes(p))
    .forEach((p) => outcome.failed.push({ index: p.slot, error: new Error('too-many-photos') }));
  await refreshPhotosCount(consultationId);
  return outcome;
};

/**
 * Store the number of photos actually saved on the case details, so the
 * count the expert sees is never more than what was really shared. A
 * convenience field: failure here is logged, not shown.
 */
export const refreshPhotosCount = async (consultationId: string): Promise<void> => {
  try {
    const snap = await getDocs(photosCol(consultationId));
    await updateDoc(doc(db, 'consultations', consultationId, 'case', 'current'), {
      'consentSnapshot.photosCount': snap.size,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Photo count was not refreshed:', (error as any)?.code || error);
  }
};

export const watchConsultationPhotos = (
  consultationId: string,
  cb: (items: ConsultationPhoto[]) => void,
  onError?: (error: any) => void
): (() => void) =>
  onSnapshot(
    // Never more than 3 documents; the limit keeps the listener bounded anyway.
    query(photosCol(consultationId), limit(MAX_PHOTOS_PER_REQUEST)),
    (snap) =>
      cb(
        snap.docs
          .filter((d) => (PHOTO_IDS as readonly string[]).includes(d.id))
          .map((d) => ({ ...(d.data() as Omit<ConsultationPhoto, 'id'>), id: d.id as PhotoId }))
          .sort((a, b) => a.id.localeCompare(b.id))
      ),
    (err) => {
      console.warn('Photo watch failed:', err?.code || err);
      onError?.(err);
    }
  );

/** Farmer only (enforced by the rules). */
export const deleteConsultationPhoto = async (consultationId: string, photoId: PhotoId): Promise<void> => {
  await deleteDoc(doc(db, 'consultations', consultationId, 'photos', photoId));
  await refreshPhotosCount(consultationId);
};
