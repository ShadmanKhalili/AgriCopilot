import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTOS_PER_REQUEST,
  MIN_SIDE,
  PHOTO_HARD_CAP_BYTES,
  PHOTO_MAX_BASE64_CHARS,
  PHOTO_MAX_SIDE,
  PHOTO_TARGET_BYTES,
  QUALITY_STEPS,
  acceptablePhotoFiles,
  base64ByteLength,
  chooseEncoding,
  compressionAttempts,
  fitWithin,
  fitsHardCap,
  fitsTarget,
  isValidBase64,
  jpegBase64FromDataUrl,
  photoSrc,
} from './imageCompress';

describe('fitWithin', () => {
  it('scales a landscape photo so the long side is 1024', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1024, height: 768 });
  });
  it('scales a portrait photo so the long side is 1024', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 768, height: 1024 });
  });
  it('never upscales a small photo', () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });
  it('keeps at least 1px on a very thin image', () => {
    expect(fitWithin(10000, 2)).toEqual({ width: 1024, height: 1 });
  });
  it('treats bad input as 1px instead of NaN', () => {
    expect(fitWithin(NaN, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('compressionAttempts', () => {
  it('starts at full size with the highest quality, then steps quality down', () => {
    const attempts = compressionAttempts(4000, 3000);
    expect(attempts[0]).toEqual({ width: 1024, height: 768, quality: QUALITY_STEPS[0] });
    expect(attempts.slice(0, QUALITY_STEPS.length).map((a) => a.quality)).toEqual([...QUALITY_STEPS]);
    expect(attempts.slice(0, QUALITY_STEPS.length).every((a) => a.width === 1024)).toBe(true);
  });
  it('then shrinks the size, never below the minimum side', () => {
    const attempts = compressionAttempts(4000, 3000);
    const sides = attempts.map((a) => Math.max(a.width, a.height));
    expect(Math.max(...sides)).toBe(PHOTO_MAX_SIDE);
    expect(Math.min(...sides)).toBe(MIN_SIDE);
    for (let i = 1; i < sides.length; i++) expect(sides[i]).toBeLessThanOrEqual(sides[i - 1]);
  });
  it('does not repeat a size for a photo already at the minimum', () => {
    const attempts = compressionAttempts(400, 300);
    expect(attempts).toHaveLength(QUALITY_STEPS.length);
    expect(attempts.every((a) => a.width === 400 && a.height === 300)).toBe(true);
  });
});

describe('base64 helpers', () => {
  it('computes decoded byte length with padding', () => {
    expect(base64ByteLength('')).toBe(0);
    expect(base64ByteLength('QQ==')).toBe(1);
    expect(base64ByteLength('QUI=')).toBe(2);
    expect(base64ByteLength('QUJD')).toBe(3);
  });
  it('accepts only clean base64', () => {
    expect(isValidBase64('QUJD')).toBe(true);
    expect(isValidBase64('QUJ')).toBe(false);
    expect(isValidBase64('QU"D')).toBe(false);
    expect(isValidBase64('')).toBe(false);
    expect(isValidBase64(42)).toBe(false);
  });
  it('extracts the body of a JPEG data URL only', () => {
    expect(jpegBase64FromDataUrl('data:image/jpeg;base64,QUJD')).toBe('QUJD');
    expect(jpegBase64FromDataUrl('data:image/png;base64,QUJD')).toBeNull();
    expect(jpegBase64FromDataUrl('data:,')).toBeNull();
  });
  it('builds a safe img src only for JPEG + valid base64', () => {
    expect(photoSrc('image/jpeg', 'QUJD')).toBe('data:image/jpeg;base64,QUJD');
    expect(photoSrc('text/html', 'QUJD')).toBeNull();
    expect(photoSrc('image/jpeg', 'javascript:alert(1)')).toBeNull();
    expect(photoSrc('image/jpeg', 'A'.repeat(PHOTO_MAX_BASE64_CHARS + 4))).toBeNull();
  });
});

describe('size limits', () => {
  it('keeps the hard cap well under the 1 MiB Firestore document limit', () => {
    expect(PHOTO_TARGET_BYTES).toBeLessThan(PHOTO_HARD_CAP_BYTES);
    expect(PHOTO_MAX_BASE64_CHARS).toBeLessThanOrEqual(290000); // firestore.rules limit
    expect(PHOTO_MAX_BASE64_CHARS * 2).toBeLessThan(1024 * 1024);
  });
  it('classifies byte counts', () => {
    expect(fitsTarget(PHOTO_TARGET_BYTES)).toBe(true);
    expect(fitsTarget(PHOTO_TARGET_BYTES + 1)).toBe(false);
    expect(fitsHardCap(PHOTO_HARD_CAP_BYTES)).toBe(true);
    expect(fitsHardCap(PHOTO_HARD_CAP_BYTES + 1)).toBe(false);
    expect(fitsTarget(0)).toBe(false);
  });
});

describe('chooseEncoding', () => {
  const attempts = compressionAttempts(4000, 3000);

  it('stops at the first attempt under the target', () => {
    let calls = 0;
    const result = chooseEncoding(attempts, (a) => {
      calls++;
      return { bytes: a.quality > 0.7 ? 300_000 : 120_000 };
    });
    expect(result?.bytes).toBe(120_000);
    expect(result?.attempt.quality).toBe(0.62);
    expect(calls).toBe(3);
  });
  it('falls back to the smallest result under the hard cap', () => {
    const result = chooseEncoding(attempts, (a) => ({ bytes: 160_000 + Math.round(a.quality * 1000) + a.width }));
    expect(result).not.toBeNull();
    expect(result!.bytes).toBeGreaterThan(PHOTO_TARGET_BYTES);
    expect(fitsHardCap(result!.bytes)).toBe(true);
    expect(Math.max(result!.attempt.width, result!.attempt.height)).toBe(MIN_SIDE);
  });
  it('returns null when nothing fits the hard cap', () => {
    expect(chooseEncoding(attempts, () => ({ bytes: PHOTO_HARD_CAP_BYTES + 1 }))).toBeNull();
  });
  it('skips failed encodes', () => {
    const result = chooseEncoding(attempts, (a) => (a.quality === QUALITY_STEPS[0] ? null : { bytes: 1000 }));
    expect(result?.attempt.quality).toBe(QUALITY_STEPS[1]);
  });
});

describe('acceptablePhotoFiles', () => {
  const img = (size = 1000) => ({ type: 'image/jpeg', size });
  it(`accepts at most ${MAX_PHOTOS_PER_REQUEST} photos in total`, () => {
    const { accepted, rejected } = acceptablePhotoFiles([img(), img(), img(), img()], 1);
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(2);
  });
  it('rejects non-images, empty and huge files', () => {
    const { accepted, rejected } = acceptablePhotoFiles(
      [{ type: 'application/pdf', size: 10 }, img(0), img(30 * 1024 * 1024), img()],
      0
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(3);
  });
});
