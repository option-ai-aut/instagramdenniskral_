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

// ── AI-detection evasion ─────────────────────────────────────────────────────

/**
 * Applies subtle, visually imperceptible transformations to a generated image
 * so that statistical AI-detection fingerprints no longer match the original.
 *
 * Techniques applied:
 *  1. Luminance noise  – correlated per-pixel ±4 on all channels (sensor ISO noise)
 *  2. Chroma noise     – independent per-channel ±3 (color sensor variance)
 *  3. Subtle color drift – global ±3 random shift on R/G/B (lens/white-balance drift)
 *  4. Micro JPEG artifacts – double-encode at 91 % → re-encode at 94 %
 *  5. 2 % grain overlay  – fine luminance grain on the final pass
 *
 * All operations run on the CPU via Canvas getImageData/putImageData.
 * Processing time ≈ 0.5 – 2 s for a 2 K image.
 */
export function humanizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();

    img.onload = () => {
      // ── Pass 1: noise + drift ───────────────────────────────────────────────
      const c1 = document.createElement("canvas");
      c1.width  = img.naturalWidth;
      c1.height = img.naturalHeight;
      const ctx1 = c1.getContext("2d");
      if (!ctx1) { reject(new Error("Canvas not available")); return; }
      ctx1.drawImage(img, 0, 0);

      const id1 = ctx1.getImageData(0, 0, c1.width, c1.height);
      const px  = id1.data;

      // Global color drift (random ±3 per channel – subtle white-balance / lens shift)
      const rDrift = (Math.random() - 0.5) * 6;
      const gDrift = (Math.random() - 0.5) * 3;
      const bDrift = (Math.random() - 0.5) * 6;

      for (let i = 0; i < px.length; i += 4) {
        // Luminance component (correlated across channels → ISO-like grain)
        const luma = (Math.random() - 0.5) * 8;
        // Chroma component (independent per channel → Bayer sensor chroma variance)
        const rN = luma + (Math.random() - 0.5) * 6;
        const gN = luma + (Math.random() - 0.5) * 4;
        const bN = luma + (Math.random() - 0.5) * 6;

        px[i]     = Math.min(255, Math.max(0, px[i]     + rN + rDrift));
        px[i + 1] = Math.min(255, Math.max(0, px[i + 1] + gN + gDrift));
        px[i + 2] = Math.min(255, Math.max(0, px[i + 2] + bN + bDrift));
        // alpha unchanged
      }
      ctx1.putImageData(id1, 0, 0);

      // ── Pass 2: micro JPEG artifacts (encode at 91 %) ──────────────────────
      c1.toBlob((blob1) => {
        if (!blob1) { reject(new Error("toBlob pass-1 failed")); return; }
        const url1 = URL.createObjectURL(blob1);
        const img2 = new window.Image();

        img2.onload = () => {
          // ── Pass 3: grain overlay, then final encode at 94 % ───────────────
          const c2 = document.createElement("canvas");
          c2.width  = img2.naturalWidth;
          c2.height = img2.naturalHeight;
          const ctx2 = c2.getContext("2d");
          URL.revokeObjectURL(url1);
          if (!ctx2) { reject(new Error("Canvas pass-2 not available")); return; }
          ctx2.drawImage(img2, 0, 0);

          const id2 = ctx2.getImageData(0, 0, c2.width, c2.height);
          const px2 = id2.data;
          for (let i = 0; i < px2.length; i += 4) {
            // Fine grain: ±2 luminance noise
            const g = (Math.random() - 0.5) * 4;
            px2[i]     = Math.min(255, Math.max(0, px2[i]     + g));
            px2[i + 1] = Math.min(255, Math.max(0, px2[i + 1] + g));
            px2[i + 2] = Math.min(255, Math.max(0, px2[i + 2] + g));
          }
          ctx2.putImageData(id2, 0, 0);

          c2.toBlob((blob2) => {
            if (!blob2) { reject(new Error("toBlob pass-2 failed")); return; }
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob2);
          }, "image/jpeg", 0.94);
        };

        img2.onerror = reject;
        img2.src = url1;
      }, "image/jpeg", 0.91);
    };

    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
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
