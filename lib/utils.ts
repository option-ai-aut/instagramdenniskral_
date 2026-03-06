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
 * Breaks AI-detection fingerprints via a multi-step photographic simulation:
 *
 *  1. Resize pass 1: 78 % → 100 % (bicubic – destroys diffusion-model patterns)
 *  2. Lens blur: 0.5 px Gaussian (simulates real optics; breaks sharp AI edges)
 *  3. Resize pass 2: 92 % → 100 % (second interpolation round)
 *  4. Film grain (spatially correlated): noise is clustered like real sensor grain,
 *     not per-pixel random – statistically matches Bayer sensor read noise
 *  5. Lens vignetting: radial darkening at image corners (all real lenses do this)
 *  6. Luminance-dependent chroma noise: Bayer R/B channels noisier than G
 *  7. Chromatic aberration: R +3 px, B −3 px
 *  8. Global color drift (lens tint)
 *  9. Re-encode as JPEG at 76 %
 *
 * Always receives a data URL – caller must pre-fetch remote URLs first.
 */
export function humanizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new window.Image();

      img.onload = () => {
        try {
          const W = img.naturalWidth;
          const H = img.naturalHeight;
          if (W === 0 || H === 0) { reject(new Error("Image has zero dimensions")); return; }

          const smooth = (c: HTMLCanvasElement) => {
            const ctx = c.getContext("2d")!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            return ctx;
          };

          // ── Resize pass 1: 78 % ──────────────────────────────────────────
          const S1 = 0.78;
          const c1 = document.createElement("canvas");
          c1.width = Math.round(W * S1); c1.height = Math.round(H * S1);
          smooth(c1).drawImage(img, 0, 0, c1.width, c1.height);

          const cFull = document.createElement("canvas");
          cFull.width = W; cFull.height = H;
          smooth(cFull).drawImage(c1, 0, 0, W, H);

          // ── Lens blur 0.5 px ─────────────────────────────────────────────
          const ctxFull = cFull.getContext("2d")!;
          ctxFull.filter = "blur(0.5px)";
          ctxFull.drawImage(cFull, 0, 0);
          ctxFull.filter = "none";

          // ── Resize pass 2: 92 % ──────────────────────────────────────────
          const S2 = 0.92;
          const c2 = document.createElement("canvas");
          c2.width = Math.round(W * S2); c2.height = Math.round(H * S2);
          smooth(c2).drawImage(cFull, 0, 0, c2.width, c2.height);
          smooth(cFull).drawImage(c2, 0, 0, W, H);

          // ── Film grain (spatially correlated) ────────────────────────────
          // Generate grain at 1/4 scale → upscale → clusters like real sensor grain
          const GRAIN_SCALE = 0.28;
          const gW = Math.max(1, Math.round(W * GRAIN_SCALE));
          const gH = Math.max(1, Math.round(H * GRAIN_SCALE));
          const cGrain = document.createElement("canvas");
          cGrain.width = gW; cGrain.height = gH;
          const gCtx = cGrain.getContext("2d")!;
          const grainData = gCtx.createImageData(gW, gH);
          for (let i = 0; i < grainData.data.length; i += 4) {
            const v = Math.round(Math.random() * 255);
            grainData.data[i] = v; grainData.data[i+1] = v;
            grainData.data[i+2] = v; grainData.data[i+3] = 255;
          }
          gCtx.putImageData(grainData, 0, 0);

          // Overlay grain at full size (soft-light blends like real film)
          ctxFull.save();
          ctxFull.globalCompositeOperation = "soft-light";
          ctxFull.globalAlpha = 0.06;
          ctxFull.imageSmoothingEnabled = true;
          ctxFull.imageSmoothingQuality = "high";
          ctxFull.drawImage(cGrain, 0, 0, W, H);
          ctxFull.restore();

          // ── Vignetting (all real lenses darken corners) ───────────────────
          const cx = W / 2, cy = H / 2;
          const outerR = Math.sqrt(cx * cx + cy * cy);
          const vignette = ctxFull.createRadialGradient(cx, cy, outerR * 0.45, cx, cy, outerR);
          vignette.addColorStop(0, "rgba(0,0,0,0)");
          vignette.addColorStop(1, "rgba(0,0,0,0.08)");
          ctxFull.save();
          ctxFull.globalCompositeOperation = "source-over";
          ctxFull.fillStyle = vignette;
          ctxFull.fillRect(0, 0, W, H);
          ctxFull.restore();

          // ── Read pixels for CA + chroma noise ────────────────────────────
          let srcData: ImageData;
          try { srcData = ctxFull.getImageData(0, 0, W, H); }
          catch (e) { reject(new Error(`getImageData failed: ${e}`)); return; }

          const s = srcData.data;
          const out = ctxFull.createImageData(W, H);
          const d = out.data;

          const CA = 3;
          const rDrift = (Math.random() - 0.5) * 6;
          const gDrift = (Math.random() - 0.5) * 3;
          const bDrift = (Math.random() - 0.5) * 6;

          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const i  = (y * W + x) * 4;
              const rI = (y * W + Math.max(0,     x - CA)) * 4;
              const bI = (y * W + Math.min(W - 1, x + CA)) * 4;

              // Bayer-like chroma noise: R and B channels noisier than G
              const luma01 = (s[i] * 0.299 + s[i+1] * 0.587 + s[i+2] * 0.114) / 255;
              const amp = 2 + (1 - luma01) * 8; // ±2 highlights → ±10 shadows
              const rN = (Math.random() - 0.5) * amp * 2.2;
              const gN = (Math.random() - 0.5) * amp * 0.9; // green noisier in Bayer
              const bN = (Math.random() - 0.5) * amp * 2.2;

              d[i]     = Math.min(255, Math.max(0, s[rI]     + rN + rDrift));
              d[i + 1] = Math.min(255, Math.max(0, s[i + 1]  + gN + gDrift));
              d[i + 2] = Math.min(255, Math.max(0, s[bI + 2] + bN + bDrift));
              d[i + 3] = 255;
            }
          }
          ctxFull.putImageData(out, 0, 0);

          // ── JPEG at 76 % ─────────────────────────────────────────────────
          cFull.toBlob(
            (blob) => {
              if (!blob) { reject(new Error("toBlob returned null")); return; }
              const reader = new FileReader();
              reader.onload  = () => resolve(reader.result as string);
              reader.onerror = (e) => reject(new Error(`FileReader: ${e}`));
              reader.readAsDataURL(blob);
            },
            "image/jpeg",
            0.95
          );
        } catch (err) { reject(err); }
      };

      img.onerror = (e) => reject(new Error(`Image load failed: ${e}`));
      img.src = dataUrl;
    } catch (err) { reject(err); }
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
