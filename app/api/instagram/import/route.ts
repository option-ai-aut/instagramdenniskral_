/**
 * POST /api/instagram/import
 *
 * Fetches images from a public Instagram post URL.
 * Supports single posts and carousels.
 *
 * Key fix: deduplicates by CDN filename (not URL) to avoid the same image
 * appearing multiple times in different resolutions (s640x640, s1080x1080, etc.)
 *
 * Body: { url: string }
 * Response: { images: [{ base64, mimeType, index }], isCarousel: boolean, postUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function extractShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** Extract the CDN filename (without query params) as a stable identity key. */
function cdnKey(url: string): string {
  try {
    return new URL(url).pathname.split("/").pop() ?? url;
  } catch {
    return url;
  }
}

/** Prefer full-resolution URLs over thumbnails when deduplicating. */
function qualityScore(url: string): number {
  if (url.includes("s150x150") || url.includes("_p150x150")) return 0;
  if (url.includes("s240x240") || url.includes("s320x320")) return 1;
  if (url.includes("s480x480") || url.includes("s640x640")) return 2;
  if (url.includes("s1080x1080")) return 3;
  return 4; // no size constraint = best
}

/**
 * Merge a candidate URL into a map keyed by CDN filename.
 * Keeps the highest-quality variant per unique image.
 */
function mergeUrl(map: Map<string, string>, url: string): void {
  if (!url.startsWith("https://")) return;
  // Skip profile pictures and obvious thumbnails
  if (url.includes("profile") || url.includes("s150x150") || url.includes("_p150x150")) return;

  const key = cdnKey(url);
  const existing = map.get(key);
  if (!existing || qualityScore(url) > qualityScore(existing)) {
    map.set(key, url);
  }
}

async function downloadImage(
  url: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": MOBILE_UA,
        Referer: "https://www.instagram.com/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    if (!mimeType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, mimeType };
  } catch {
    return null;
  }
}

/** oEmbed fallback – returns at most 1 image URL */
async function fetchViaOembed(postUrl: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}&maxwidth=1080`,
      { headers: { "User-Agent": MOBILE_UA } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data.thumbnail_url) return [data.thumbnail_url as string];
  } catch { /* fall through */ }
  return [];
}

/**
 * Parse page HTML and extract unique image URLs.
 * Uses three strategies in priority order; deduplicates by CDN filename.
 */
function extractFromHtml(html: string): string[] {
  // Map: CDN filename → best URL
  const byFilename = new Map<string, string>();

  // ── Strategy A: window._sharedData JSON (best: gives exact carousel structure) ──
  const sharedMatch = html.match(/window\._sharedData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
  if (sharedMatch) {
    try {
      const data = JSON.parse(sharedMatch[1]);
      const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        // Single image
        if (media.display_url) mergeUrl(byFilename, media.display_url as string);
        // Carousel slides
        const edges: Array<{ node: { display_url?: string; display_resources?: Array<{ src: string }> } }> =
          media?.edge_sidecar_to_children?.edges ?? [];
        for (const edge of edges) {
          // Prefer display_url (full res) over display_resources
          if (edge?.node?.display_url) {
            mergeUrl(byFilename, edge.node.display_url);
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ── Strategy B: display_url keys in any JSON blob ──────────────────────────────
  // Only match "display_url":"<url>" — not display_resources (those are low-res thumbnails)
  const displayUrlMatches = [
    ...html.matchAll(/"display_url"\s*:\s*"(https?:[^"]{10,})"/g),
  ];
  for (const m of displayUrlMatches) {
    const u = m[1]
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/");
    if (u.includes("cdninstagram") || u.includes("fbcdn")) {
      mergeUrl(byFilename, u);
    }
  }

  // ── Strategy C: og:image meta tag ─────────────────────────────────────────────
  // Instagram puts the first/main image here (or the selected carousel item)
  const ogMatches = [
    ...html.matchAll(/property="og:image"\s+content="([^"]+)"/gi),
    ...html.matchAll(/content="([^"]+)"\s+property="og:image"/gi),
  ];
  for (const m of ogMatches) {
    const u = m[1].replace(/&amp;/g, "&");
    if (u.includes("cdninstagram") || u.includes("fbcdn")) {
      mergeUrl(byFilename, u);
    }
  }

  return [...byFilename.values()];
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL fehlt" }, { status: 400 });
    }

    const cleanUrl = url.trim().split("?")[0].replace(/\/$/, "") + "/";
    const shortcode = extractShortcode(cleanUrl);

    if (!shortcode) {
      return NextResponse.json(
        { error: "Ungültige Instagram-URL. Erwartet: https://www.instagram.com/p/SHORTCODE/" },
        { status: 400 }
      );
    }

    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    let rawUrls: string[] = [];

    // ── Primary: fetch page HTML ──────────────────────────────────────────────
    let htmlFetchError = "";
    try {
      const pageRes = await fetch(postUrl, {
        headers: {
          "User-Agent": MOBILE_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
          "Cache-Control": "no-cache",
        },
        redirect: "follow",
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        rawUrls = extractFromHtml(html);
      }
    } catch (e) {
      htmlFetchError = e instanceof Error ? e.message : "Fetch failed";
    }

    // ── Fallback: oEmbed ──────────────────────────────────────────────────────
    if (rawUrls.length === 0) {
      rawUrls = await fetchViaOembed(postUrl);
    }

    if (rawUrls.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine Bilder gefunden. Mögliche Ursachen: privater Account, Instagram blockiert Server-Anfragen, oder Post existiert nicht." +
            (htmlFetchError ? ` (${htmlFetchError})` : ""),
        },
        { status: 422 }
      );
    }

    // Cap at 20 and download in parallel
    const urlsToFetch = rawUrls.slice(0, 20);
    const downloaded = await Promise.all(urlsToFetch.map((u) => downloadImage(u)));

    const images = downloaded
      .map((d, i) => (d ? { ...d, index: i, sourceUrl: urlsToFetch[i] } : null))
      .filter(Boolean) as Array<{
        base64: string;
        mimeType: string;
        index: number;
        sourceUrl: string;
      }>;

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Bilder gefunden aber CDN blockiert Download. Bitte nochmal versuchen." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      images,
      isCarousel: images.length > 1,
      postUrl,
      shortcode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Instagram import error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
