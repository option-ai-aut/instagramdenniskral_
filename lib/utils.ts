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
