/**
 * Photo compression for sharing crop photos with a human expert.
 *
 * Photos are stored as base64 text inside Firestore documents (there is no
 * file storage product in this project), so every photo must stay well under
 * Firestore's 1 MiB document limit. The plan:
 *
 *   - longest side at most 1024 px (never upscale),
 *   - JPEG, quality stepped down until the photo is at most ~150 KB,
 *   - if even the lowest quality is too big, shrink the size and try again,
 *   - never accept anything over the hard cap (~215 KB), which the Firestore
 *     rules also enforce on the stored base64 text.
 *
 * Everything except `compressPhotoFile` is pure and unit-tested under node.
 * `compressPhotoFile` is the thin browser-only canvas step.
 */

export const PHOTO_MIME_TYPE = 'image/jpeg';
export const PHOTO_MAX_SIDE = 1024;
/** Aim for this many bytes per photo. */
export const PHOTO_TARGET_BYTES = 150 * 1024;
/** Never store a photo bigger than this. Keep in step with firestore.rules. */
export const PHOTO_HARD_CAP_BYTES = 215_000;
/** Base64 length that matches the hard cap (286 668); firestore.rules allows up to 290000. */
export const PHOTO_MAX_BASE64_CHARS = Math.ceil(PHOTO_HARD_CAP_BYTES / 3) * 4;
/** At most this many photos per expert request. */
export const MAX_PHOTOS_PER_REQUEST = 3;
/** Refuse to even open files bigger than this (very large camera RAW etc.). */
export const MAX_INPUT_FILE_BYTES = 25 * 1024 * 1024;

export const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42] as const;
/** Each extra round shrinks the longest side by this factor. */
export const SHRINK_FACTOR = 0.75;
/** Never shrink below this longest side; a smaller photo is useless to an expert. */
export const MIN_SIDE = 480;

export interface Size {
  width: number;
  height: number;
}

export interface EncodeAttempt extends Size {
  quality: number;
}

export interface CompressedPhoto extends Size {
  base64: string;
  mimeType: typeof PHOTO_MIME_TYPE;
  bytes: number;
}

/** Scale a size so its longest side is at most `maxSide`. Never upscales. */
export const fitWithin = (width: number, height: number, maxSide: number = PHOTO_MAX_SIDE): Size => {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: w, height: h };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
};

/**
 * The ordered list of (size, quality) encodings to try. First every quality
 * step at the full 1024 px size, then the same steps at smaller sizes, down to
 * MIN_SIDE. The caller stops at the first attempt that fits the target.
 */
export const compressionAttempts = (srcWidth: number, srcHeight: number): EncodeAttempt[] => {
  const attempts: EncodeAttempt[] = [];
  let size = fitWithin(srcWidth, srcHeight, PHOTO_MAX_SIDE);
  const seen = new Set<string>();
  for (let round = 0; round < 6; round++) {
    const key = `${size.width}x${size.height}`;
    if (!seen.has(key)) {
      seen.add(key);
      QUALITY_STEPS.forEach((quality) => attempts.push({ ...size, quality }));
    }
    const longest = Math.max(size.width, size.height);
    if (longest <= MIN_SIDE) break;
    size = fitWithin(size.width, size.height, Math.max(MIN_SIDE, Math.round(longest * SHRINK_FACTOR)));
  }
  return attempts;
};

/** Decoded byte length of a base64 string (no data-URL prefix). */
export const base64ByteLength = (base64: string): number => {
  const len = base64.length;
  if (len === 0) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
};

/** Strict base64 alphabet check, so only real image bytes are ever rendered. */
export const isValidBase64 = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length % 4 === 0 &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(value);

/** Pull the base64 body out of a JPEG data URL; null for anything else. */
export const jpegBase64FromDataUrl = (dataUrl: string): string | null => {
  const prefix = `data:${PHOTO_MIME_TYPE};base64,`;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) return null;
  const body = dataUrl.slice(prefix.length);
  return isValidBase64(body) ? body : null;
};

/**
 * Build a safe `<img src>` from stored fields. Returns null unless the mime
 * type is exactly JPEG and the body is clean base64, so a tampered document
 * can never inject a different kind of URL.
 */
export const photoSrc = (mimeType: unknown, base64: unknown): string | null => {
  if (mimeType !== PHOTO_MIME_TYPE || !isValidBase64(base64)) return null;
  if (base64.length > PHOTO_MAX_BASE64_CHARS) return null;
  return `data:${PHOTO_MIME_TYPE};base64,${base64}`;
};

/** Is an encoded result good enough to stop trying? */
export const fitsTarget = (bytes: number): boolean => bytes > 0 && bytes <= PHOTO_TARGET_BYTES;

/** Is an encoded result small enough to store at all? */
export const fitsHardCap = (bytes: number): boolean => bytes > 0 && bytes <= PHOTO_HARD_CAP_BYTES;

/**
 * Run the attempts with a given encoder and pick the result: the first one
 * that fits the target, otherwise the smallest one under the hard cap,
 * otherwise null. Pure apart from whatever `encode` does, so it is testable
 * with a fake encoder.
 */
export const chooseEncoding = <T extends { bytes: number }>(
  attempts: EncodeAttempt[],
  encode: (attempt: EncodeAttempt) => T | null
): (T & { attempt: EncodeAttempt }) | null => {
  let best: (T & { attempt: EncodeAttempt }) | null = null;
  for (const attempt of attempts) {
    const result = encode(attempt);
    if (!result || !(result.bytes > 0)) continue;
    if (fitsTarget(result.bytes)) return { ...result, attempt };
    if (fitsHardCap(result.bytes) && (!best || result.bytes < best.bytes)) {
      best = { ...result, attempt };
    }
  }
  return best;
};

/** Trim a picked list of files to the free slots and image types only. */
export const acceptablePhotoFiles = <F extends { type: string; size: number }>(
  files: F[],
  alreadyChosen: number
): { accepted: F[]; rejected: F[] } => {
  const free = Math.max(0, MAX_PHOTOS_PER_REQUEST - alreadyChosen);
  const accepted: F[] = [];
  const rejected: F[] = [];
  for (const file of files) {
    const ok = /^image\//.test(file.type || '') && file.size > 0 && file.size <= MAX_INPUT_FILE_BYTES;
    if (ok && accepted.length < free) accepted.push(file);
    else rejected.push(file);
  }
  return { accepted, rejected };
};

// ---------------------------------------------------------------
// Browser-only step (canvas). Not run under node tests.
// ---------------------------------------------------------------

const loadBitmap = async (file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> => {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies the phone camera's EXIF rotation.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall back to <img> below (older Safari, some formats).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image-decode-failed'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

/** Compress one picked file to a JPEG that fits the limits, or throw. */
export const compressPhotoFile = async (file: Blob): Promise<CompressedPhoto> => {
  if (file.size > MAX_INPUT_FILE_BYTES) throw new Error('photo-too-large');
  const image = await loadBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-unavailable');
    const chosen = chooseEncoding(compressionAttempts(image.width, image.height), (attempt) => {
      canvas.width = attempt.width;
      canvas.height = attempt.height;
      // JPEG has no transparency: paint white first so PNG cut-outs are not black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, attempt.width, attempt.height);
      ctx.drawImage(image.source, 0, 0, attempt.width, attempt.height);
      const base64 = jpegBase64FromDataUrl(canvas.toDataURL(PHOTO_MIME_TYPE, attempt.quality));
      return base64 ? { base64, bytes: base64ByteLength(base64) } : null;
    });
    if (!chosen) throw new Error('photo-not-compressible');
    return {
      base64: chosen.base64,
      mimeType: PHOTO_MIME_TYPE,
      width: chosen.attempt.width,
      height: chosen.attempt.height,
      bytes: chosen.bytes,
    };
  } finally {
    image.close();
  }
};
