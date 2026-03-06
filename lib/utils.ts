import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(",")[1];
}

export function base64ToDataUrl(base64: string, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${base64}`;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// ── Aspect ratio helpers (shared client + server) ────────────────────────────

const SUPPORTED_RATIOS: { ratio: number; str: string }[] = [
  { ratio: 1 / 1,  str: "1:1"  },
  { ratio: 2 / 3,  str: "2:3"  },
  { ratio: 3 / 2,  str: "3:2"  },
  { ratio: 3 / 4,  str: "3:4"  },
  { ratio: 4 / 3,  str: "4:3"  },
  { ratio: 4 / 5,  str: "4:5"  },
  { ratio: 5 / 4,  str: "5:4"  },
  { ratio: 9 / 16, str: "9:16" },
  { ratio: 16 / 9, str: "16:9" },
  { ratio: 21 / 9, str: "21:9" },
];

/** Map width/height to the nearest supported Gemini aspectRatio string. */
export function nearestAspectRatio(w: number, h: number): string {
  if (w <= 0 || h <= 0) return "1:1";
  const r = w / h;
  let best = SUPPORTED_RATIOS[0];
  let bestDiff = Math.abs(r - best.ratio);
  for (const candidate of SUPPORTED_RATIOS) {
    const diff = Math.abs(r - candidate.ratio);
    if (diff < bestDiff) { bestDiff = diff; best = candidate; }
  }
  return best.str;
}

/**
 * Detect the aspect ratio of an image from its data URL (or full src URL).
 * Runs in the browser – resolves instantly if the image is already decoded.
 */
export function getImageAspectRatio(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(nearestAspectRatio(img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve("1:1");
    img.src = src;
  });
}

/**
 * Compress an image client-side using Canvas before uploading / sending to the API.
 * Resizes so the longest side ≤ maxPx, then encodes as JPEG at the given quality.
 * Keeps images well under Vercel's 4.5 MB payload limit.
 *
 * @param src     data URL or object URL of the source image
 * @param maxPx   max pixels on longest side (default 2048)
 * @param quality JPEG quality 0–1 (default 0.92)
 * @returns { base64, mimeType, aspectRatio }
 */
export function compressImage(
  src: string,
  maxPx = 2048,
  quality = 0.92
): Promise<{ base64: string; mimeType: string; aspectRatio: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not available")); return; }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve({
              base64:      dataUrl.split(",")[1],
              mimeType:    "image/jpeg",
              aspectRatio: nearestAspectRatio(w, h),
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

// ── Center-crop ──────────────────────────────────────────────────────────────

/**
 * Center-crops a data URL to the given aspect ratio (e.g. "1:1" or "4:5").
 * Returns the cropped image as a JPEG data URL.
 */
export function cropImage(dataUrl: string, ratio: "1:1" | "4:5"): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const [rw, rh] = ratio.split(":").map(Number);
      const targetRatio = rw / rh;
      const srcRatio    = w / h;

      let cropW: number, cropH: number;
      if (srcRatio > targetRatio) {
        // wider than target → crop sides
        cropH = h;
        cropW = Math.round(h * targetRatio);
      } else {
        // taller than target → crop top/bottom
        cropW = w;
        cropH = Math.round(w / targetRatio);
      }

      const offsetX = Math.floor((w - cropW) / 2);
      const offsetY = Math.floor((h - cropH) / 2);

      const canvas = document.createElement("canvas");
      canvas.width  = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not available")); return; }
      ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("toBlob failed")); return; }
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.97
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

// ── AI-detection evasion ─────────────────────────────────────────────────────

/**
 * Applies multiple visually imperceptible transformations to break AI-detection
 * statistical fingerprints. Techniques:
 *
 *  1. Chromatic aberration  – R channel shifted +2px right, B shifted -2px left
 *     (mimics real camera lens dispersion; strong signal vs AI-perfect pixels)
 *  2. Luminance noise       – correlated ±12 across channels (ISO sensor grain)
 *  3. Chroma noise          – independent ±8 per channel (Bayer sensor variance)
 *  4. Global color drift    – random ±5 per R/G/B (white-balance / lens tint)
 *  5. JPEG pass 1           – encode at 87 % (introduces DCT block artefacts)
 *  6. Subtle sharpening     – unsharp-mask approximation (real cameras sharpen)
 *  7. Fine grain overlay    – ±4 luminance grain on final pass
 *  8. JPEG pass 2           – encode at 93 % (second DCT rounding layer)
 *
 * All operations: Canvas getImageData / putImageData (no server, no deps).
 * Processing time ≈ 1–4 s for a 2 K image.
 */
/**
 * Applies pixel-level transformations to break AI-detection fingerprints.
 * Always receives a data URL (caller pre-fetches remote URLs).
 *
 * Single-pass approach (no nested image loads) for maximum reliability:
 *  1. Chromatic aberration  – R +2px, B -2px
 *  2. Luminance + chroma noise
 *  3. Global color drift
 *  4. Re-encode as JPEG at 88 %
 */
export function humanizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new window.Image();

      img.onload = () => {
        try {
          const W = img.naturalWidth;
          const H = img.naturalHeight;

          if (W === 0 || H === 0) {
            reject(new Error("Image has zero dimensions"));
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width  = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas 2d context unavailable")); return; }

          ctx.drawImage(img, 0, 0);

          // Read source pixels
          let srcData: ImageData;
          try {
            srcData = ctx.getImageData(0, 0, W, H);
          } catch (e) {
            reject(new Error(`getImageData failed (tainted canvas?): ${e}`));
            return;
          }

          const s = srcData.data;
          const out = ctx.createImageData(W, H);
          const d   = out.data;

          const CA   = 2;                            // chromatic aberration shift px
          const rDrift = (Math.random() - 0.5) * 10;
          const gDrift = (Math.random() - 0.5) * 5;
          const bDrift = (Math.random() - 0.5) * 10;

          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const i  = (y * W + x) * 4;
              const rI = (y * W + Math.max(0,     x - CA)) * 4; // R from x-CA
              const bI = (y * W + Math.min(W - 1, x + CA)) * 4; // B from x+CA

              const luma = (Math.random() - 0.5) * 24;
              const rN   = luma + (Math.random() - 0.5) * 16;
              const gN   = luma + (Math.random() - 0.5) * 10;
              const bN   = luma + (Math.random() - 0.5) * 16;

              d[i]     = Math.min(255, Math.max(0, s[rI]     + rN + rDrift));
              d[i + 1] = Math.min(255, Math.max(0, s[i + 1]  + gN + gDrift));
              d[i + 2] = Math.min(255, Math.max(0, s[bI + 2] + bN + bDrift));
              d[i + 3] = 255;
            }
          }

          ctx.putImageData(out, 0, 0);

          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error("canvas.toBlob returned null")); return; }
              const reader = new FileReader();
              reader.onload  = () => resolve(reader.result as string);
              reader.onerror = (e) => reject(new Error(`FileReader failed: ${e}`));
              reader.readAsDataURL(blob);
            },
            "image/jpeg",
            0.88
          );
        } catch (innerErr) {
          reject(innerErr);
        }
      };

      img.onerror = (e) => reject(new Error(`Image failed to load: ${e}`));
      img.src = dataUrl;
    } catch (outerErr) {
      reject(outerErr);
    }
  });
}

// ── Download filename helper ──────────────────────────────────────────────────

/** Returns a safe filename timestamp: "Insta Studio 2026-02-28 14-30" */
export function studioFilename(suffix?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const base = `Insta Studio ${date} ${time}`;
  return suffix ? `${base} ${suffix}` : base;
}
