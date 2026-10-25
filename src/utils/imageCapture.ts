/**
 * Shared capture helpers for the diagnosis image pipeline.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Gemini tiles images at 768px. Every capture path in this app used to
 * downscale to 480x360 (live frames, preset frames) or 640x480 / 800px
 * (snapshot, upload) before the picture ever reached the model. That is LESS
 * THAN ONE TILE — the model was being asked to read a lesion out of an image
 * that had almost no detail left in it, and no amount of prompt tuning or
 * thinking depth can recover pixels that were thrown away before the request
 * was built.
 *
 * These helpers keep the pixels. Gemini's own `mediaResolution:
 * MEDIA_RESOLUTION_HIGH` ("zoomed reframing with 256 tokens") then crops to
 * the salient region server-side, so we get a close-up for the same token
 * budget the 480x360 path was already paying.
 */

/** Longest edge, in pixels, of a live frame we send to the model. */
export const CAPTURE_MAX_EDGE = 1024;

/** JPEG quality for live frames. */
export const CAPTURE_QUALITY = 0.85;

/** Longest edge, in pixels, of an uploaded still photo. */
export const UPLOAD_MAX_EDGE = 1280;

/** JPEG quality for an uploaded still photo. */
export const UPLOAD_QUALITY = 0.85;

/** Longest edge, in pixels, of the auto-cropped detail window. */
export const FOCUS_CROP_MAX_EDGE = 640;

export type CaptureSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

const sourceSize = (source: CaptureSource): { width: number; height: number } => {
  const el = source as unknown as Record<string, number>;
  const width = el.videoWidth || el.naturalWidth || el.width || 0;
  const height = el.videoHeight || el.naturalHeight || el.height || 0;
  return { width, height };
};

/**
 * Draw `source` onto a canvas, preserving its aspect ratio.
 *
 * Never upscales: stretching a 640px camera stream up to 1024 adds no detail,
 * it only costs bytes. The source resolution is raised at the camera
 * (`getUserMedia` constraints) instead, which is the only place real detail
 * can be added.
 */
export const captureToDataUrl = (
  source: CaptureSource,
  maxEdge: number = CAPTURE_MAX_EDGE,
  quality: number = CAPTURE_QUALITY
): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const { width, height } = sourceSize(source);
  if (!width || !height) return '';

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

/**
 * Crop out the most detailed region of an image.
 *
 * A plant disease shows up as high-frequency texture — speckling, necrotic
 * edges, mould growth, chlorotic mottling. The highest-detail window in a
 * field photo is therefore usually where the lesion is, even when the leaf
 * occupies a small part of the frame.
 *
 * This is deliberately a *texture* detector, not a disease detector: it
 * cannot tell blight from rust, but it reliably stops the model from having
 * to squint at a whole plant to find the spot that matters. It is used as an
 * EXTRA image alongside the full frame, never instead of it, and the prompt
 * tells the model how to use it, so a misfired crop cannot mislead the
 * diagnosis on its own.
 *
 * Returns null when the crop would not add anything: the source is already
 * small, or the busiest region is not meaningfully more detailed than the
 * average (i.e. the image is flat and a crop adds no information).
 */
export const computeFocusCrop = (
  dataUrl: string,
  maxEdge: number = FOCUS_CROP_MAX_EDGE
): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (!width || !height || Math.max(width, height) < 400) {
          resolve(null);
          return;
        }

        // Coarse grayscale grid used for the detail scan.
        const GRID = 48;
        const scan = document.createElement('canvas');
        scan.width = GRID;
        scan.height = GRID;
        const scanCtx = scan.getContext('2d', { willReadFrequently: true });
        if (!scanCtx) {
          resolve(null);
          return;
        }
        scanCtx.drawImage(img, 0, 0, GRID, GRID);

        let pixels: Uint8ClampedArray;
        try {
          pixels = scanCtx.getImageData(0, 0, GRID, GRID).data;
        } catch {
          // A tainted canvas cannot be read; not worth failing the upload for.
          resolve(null);
          return;
        }

        const lum = (x: number, y: number): number => {
          const i = (y * GRID + x) * 4;
          return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        };

        // Per-cell edge energy (absolute Laplacian).
        const CELLS = 12;
        const cellPx = GRID / CELLS;
        const detail = new Float64Array(CELLS * CELLS);
        for (let y = 1; y < GRID - 1; y++) {
          for (let x = 1; x < GRID - 1; x++) {
            const lap = Math.abs(
              4 * lum(x, y) - lum(x - 1, y) - lum(x + 1, y) - lum(x, y - 1) - lum(x, y + 1)
            );
            const cx = Math.min(CELLS - 1, Math.floor(x / cellPx));
            const cy = Math.min(CELLS - 1, Math.floor(y / cellPx));
            detail[cy * CELLS + cx] += lap;
          }
        }

        // Find the busiest WIN x WIN window of cells (about a third of each
        // dimension, i.e. a ninth of the area).
        const WIN = 4;
        let bestX = 0;
        let bestY = 0;
        let bestSum = -1;
        let total = 0;
        for (let cy = 0; cy < CELLS; cy++) {
          for (let cx = 0; cx < CELLS; cx++) {
            total += detail[cy * CELLS + cx];
          }
        }
        const mean = total / Math.max(1, CELLS * CELLS);

        for (let y = 0; y + WIN <= CELLS; y++) {
          for (let x = 0; x + WIN <= CELLS; x++) {
            let sum = 0;
            for (let dy = 0; dy < WIN; dy++) {
              for (let dx = 0; dx < WIN; dx++) {
                sum += detail[(y + dy) * CELLS + (x + dx)];
              }
            }
            if (sum > bestSum) {
              bestSum = sum;
              bestX = x;
              bestY = y;
            }
          }
        }

        // If the busiest patch is not clearly busier than average, the image is
        // flat and cropping would only throw context away.
        if (bestSum <= mean * WIN * WIN * 1.15) {
          resolve(null);
          return;
        }

        const sx = (bestX / CELLS) * width;
        const sy = (bestY / CELLS) * height;
        const sw = (WIN / CELLS) * width;
        const sh = (WIN / CELLS) * height;

        const out = document.createElement('canvas');
        const outCtx = out.getContext('2d');
        if (!outCtx) {
          resolve(null);
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(sw, sh));
        out.width = Math.max(1, Math.round(sw * scale));
        out.height = Math.max(1, Math.round(sh * scale));
        outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
        resolve(out.toDataURL('image/jpeg', CAPTURE_QUALITY));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
