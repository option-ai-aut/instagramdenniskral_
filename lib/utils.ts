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
export async function humanizeImage(dataUrl: string): Promise<string> {
  // Helper: load a data/blob URL into an HTMLImageElement
  const loadImg = (src: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const i = new window.Image();
      i.onload = () => res(i);
      i.onerror = (e) => rej(new Error(`Image load failed: ${e}`));
      i.src = src;
    });

  // Helper: encode canvas to JPEG blob
  const toBlob = (c: HTMLCanvasElement, q: number): Promise<Blob> =>
    new Promise((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob null"))), "image/jpeg", q)
    );

  // Helper: decode JPEG blob back to a canvas
  const blobToCanvas = (blob: Blob): Promise<HTMLCanvasElement> => {
    const url = URL.createObjectURL(blob);
    return loadImg(url).then((i2) => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      c.width = i2.naturalWidth; c.height = i2.naturalHeight;
      c.getContext("2d")!.drawImage(i2, 0, 0);
      return c;
    }).catch((err) => { URL.revokeObjectURL(url); throw err; });
  };

  // Helper: blob → data URL
  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result as string);
      r.onerror = (e) => rej(new Error(`FileReader: ${e}`));
      r.readAsDataURL(blob);
    });

  const smooth = (c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return ctx;
  };

  const img = await loadImg(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (W === 0 || H === 0) throw new Error("Image has zero dimensions");

  // ── Step 1: Two gentle resize passes (92 % → full, 97 % → full) ─────────
  // Breaks diffusion-model pixel grid statistics via bicubic interpolation.
  const c1 = document.createElement("canvas");
  c1.width = Math.round(W * 0.92); c1.height = Math.round(H * 0.92);
  smooth(c1).drawImage(img, 0, 0, c1.width, c1.height);

  const cFull = document.createElement("canvas");
  cFull.width = W; cFull.height = H;
  smooth(cFull).drawImage(c1, 0, 0, W, H);

  const c2 = document.createElement("canvas");
  c2.width = Math.round(W * 0.97); c2.height = Math.round(H * 0.97);
  smooth(c2).drawImage(cFull, 0, 0, c2.width, c2.height);
  smooth(cFull).drawImage(c2, 0, 0, W, H);

  const ctxFull = cFull.getContext("2d")!;

  // ── Step 2: S-curve LUT + subtle CA (completely invisible) ───────────────
  const srcData = ctxFull.getImageData(0, 0, W, H);
  const s = srcData.data;
  const out = ctxFull.createImageData(W, H);
  const d = out.data;

  // Very subtle S-curve – mimics camera ISP tone mapping, imperceptible
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    const n = v / 255;
    const curved = n < 0.5
      ? 0.5 * Math.pow(2 * n, 0.96)
      : 1 - 0.5 * Math.pow(2 * (1 - n), 0.96);
    lut[v] = Math.round(Math.min(1, Math.max(0, curved)) * 255);
  }

  const CA = 2;
  const rDrift = (Math.random() - 0.5) * 4;
  const gDrift = (Math.random() - 0.5) * 2;
  const bDrift = (Math.random() - 0.5) * 4;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i  = (y * W + x) * 4;
      const rI = (y * W + Math.max(0,     x - CA)) * 4;
      const bI = (y * W + Math.min(W - 1, x + CA)) * 4;
      d[i]     = Math.min(255, Math.max(0, lut[s[rI]]     + rDrift));
      d[i + 1] = Math.min(255, Math.max(0, lut[s[i + 1]]  + gDrift));
      d[i + 2] = Math.min(255, Math.max(0, lut[s[bI + 2]] + bDrift));
      d[i + 3] = 255;
    }
  }
  ctxFull.putImageData(out, 0, 0);

  // ── Step 3: 3× JPEG micro-passes at 97 % ─────────────────────────────────
  // Each encode/decode cycle adds DCT quantisation artefacts that are
  // statistically indistinguishable from real multi-generation JPEG processing.
  let current: HTMLCanvasElement = cFull;
  try {
    for (let pass = 0; pass < 3; pass++) {
      const b = await toBlob(current, 0.97);
      current = await blobToCanvas(b);
    }
  } catch (passErr) {
    console.warn("[humanize] multi-pass fallback:", passErr);
    current = cFull;
  }

  // ── Step 4: Final encode at 94 % ─────────────────────────────────────────
  const finalBlob = await toBlob(current, 0.94);
  return blobToDataUrl(finalBlob);
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
