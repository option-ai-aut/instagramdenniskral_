/**
 * Fetches Google Font files for Satori (server-side PNG rendering).
 * Results are cached in memory for the lifetime of the Edge function instance.
 *
 * Satori requires font data as ArrayBuffer, so we:
 * 1. Call the Google Fonts CSS2 API to get the actual font file URL
 * 2. Download the font file
 * 3. Cache both steps to avoid repeated fetches
 */

type FontKey = `${string}:${number}`;

const cache = new Map<FontKey, ArrayBuffer>();

/** Extract a font file URL from Google Fonts CSS response. */
function extractFontUrl(css: string): string | null {
  // Prefer woff2 for Edge runtime
  const m = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?woff2['"]?\)/);
  if (m) return m[1];
  // Fallback: any format
  const m2 = css.match(/src:\s*url\(([^)]+)\)/);
  return m2?.[1] ?? null;
}

export async function fetchGoogleFont(
  family: string,
  weight: number
): Promise<ArrayBuffer | null> {
  const key: FontKey = `${family}:${weight}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    // Use CSS v1 API with a simple (non-modern) User-Agent so Google returns
    // TTF/OTF font files. Modern User-Agents get woff2 which Satori cannot parse.
    const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${weight}&display=swap`;
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const fontUrl = extractFontUrl(css);
    if (!fontUrl) return null;

    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    const data = await fontRes.arrayBuffer();
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

/** Weights that map to Satori fontWeight values. */
const WEIGHT_MAP: Record<string, number> = {
  normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800,
};

export type SatoriFontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

/**
 * Given the TextElements from a slide, collect the unique (family, weight)
 * combinations needed and return font descriptors for Satori.
 *
 * Falls back to Inter 400 if any font fails to load.
 */
export async function collectSatoriFonts(
  elements: Array<{ fontFamily?: string; fontWeight?: string }>
): Promise<SatoriFontEntry[]> {
  // Collect unique (family, weight) pairs
  const needed = new Set<string>();
  for (const el of elements) {
    const family = el.fontFamily ?? "Inter";
    const weight = WEIGHT_MAP[el.fontWeight ?? "normal"] ?? 400;
    needed.add(`${family}:${weight}`);
  }
  // Always include Inter 400 as fallback
  needed.add("Inter:400");

  const results: SatoriFontEntry[] = [];

  await Promise.all(
    [...needed].map(async (key) => {
      const [family, weightStr] = key.split(":");
      const weight = parseInt(weightStr, 10);
      const data = await fetchGoogleFont(family, weight);
      if (data) {
        results.push({
          name: family,
          data,
          weight: weight as SatoriFontEntry["weight"],
          style: "normal",
        });
      }
    })
  );

  // Guarantee at least one font
  if (results.length === 0) {
    const fallback = await fetchGoogleFont("Inter", 400);
    if (fallback) results.push({ name: "Inter", data: fallback, weight: 400, style: "normal" });
  }

  return results;
}
