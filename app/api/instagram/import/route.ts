/**
 * POST /api/instagram/import
 *
 * Fetches images from a public Instagram post URL.
 * Supports single posts and carousels.
 * Uses multiple extraction strategies (og:image, page JSON, oEmbed).
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

/** Strategy 1: Instagram oEmbed (works for public posts, returns first image only) */
async function fetchViaOembed(
  postUrl: string
): Promise<string[]> {
  try {
    const oembed = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}&maxwidth=1080`,
      { headers: { "User-Agent": MOBILE_UA } }
    );
    if (!oembed.ok) return [];
    const data = await oembed.json();
    if (data.thumbnail_url) return [data.thumbnail_url];
  } catch { /* fall through */ }
  return [];
}

/** Strategy 2: Parse page HTML for og:image tags and CDN URLs */
function extractFromHtml(html: string): string[] {
  const urls = new Set<string>();

  // og:image meta tags (Instagram typically provides the main image here)
  const ogMatches = [
    ...html.matchAll(/content="(https:\/\/[^"]+(?:cdninstagram|fbcdn)[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi),
  ];
  for (const m of ogMatches) {
    const u = m[1].replace(/&amp;/g, "&");
    // Skip thumbnails and profile pictures
    if (!u.includes("s150x150") && !u.includes("_p150x150") && !u.includes("profile")) {
      urls.add(u);
    }
  }

  // Strategy 3: window._sharedData JSON (older Instagram pages still have this)
  const sharedMatch = html.match(/window\._sharedData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
  if (sharedMatch) {
    try {
      const data = JSON.parse(sharedMatch[1]);
      const media =
        data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        if (media.display_url) urls.add(media.display_url);
        // Carousel: edge_sidecar_to_children
        const edges: Array<{ node: { display_url?: string } }> =
          media?.edge_sidecar_to_children?.edges ?? [];
        for (const edge of edges) {
          if (edge?.node?.display_url) urls.add(edge.node.display_url);
        }
      }
    } catch { /* ignore JSON parse errors */ }
  }

  // Strategy 4: Look for display_url patterns in any embedded JSON
  const displayUrls = [
    ...html.matchAll(/"display_url"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/g),
  ];
  for (const m of displayUrls) {
    const u = m[1]
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\n/g, "");
    if (u.startsWith("https://") && (u.includes("cdninstagram") || u.includes("fbcdn"))) {
      urls.add(u);
    }
  }

  // Strategy 5: Look for "scontent" CDN image URLs in JSON structures
  const scontentMatches = [
    ...html.matchAll(/"(https:\\\/\\\/scontent[^"]{10,}\.(?:jpg|jpeg|png|webp)[^"]*)"/g),
  ];
  for (const m of scontentMatches) {
    const u = m[1]
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/");
    if (
      !u.includes("s150x150") &&
      !u.includes("_p150x150") &&
      !u.includes("profile")
    ) {
      urls.add(u);
    }
  }

  return [...urls];
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
    const imageUrls: string[] = [];

    // ── Attempt 1: Fetch Instagram page HTML ──────────────────────────────────
    let htmlFetchError = "";
    try {
      const pageRes = await fetch(postUrl, {
        headers: {
          "User-Agent": MOBILE_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
          "Cache-Control": "no-cache",
        },
        redirect: "follow",
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const found = extractFromHtml(html);
        imageUrls.push(...found);
      }
    } catch (e) {
      htmlFetchError = e instanceof Error ? e.message : "Fetch failed";
    }

    // ── Attempt 2: oEmbed API as fallback / supplement ────────────────────────
    if (imageUrls.length === 0) {
      const oembedUrls = await fetchViaOembed(postUrl);
      imageUrls.push(...oembedUrls);
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine Bilder gefunden. Mögliche Ursachen: privater Account, Instagram blockiert Server-Anfragen momentan, oder der Post existiert nicht. " +
            (htmlFetchError ? `Technisch: ${htmlFetchError}` : ""),
        },
        { status: 422 }
      );
    }

    // Deduplicate by URL
    const uniqueUrls = [...new Set(imageUrls)].slice(0, 20);

    // Download all found images in parallel
    const downloaded = await Promise.all(
      uniqueUrls.map((u) => downloadImage(u))
    );

    const images = downloaded
      .map((d, i) => (d ? { ...d, index: i, sourceUrl: uniqueUrls[i] } : null))
      .filter(Boolean) as Array<{
        base64: string;
        mimeType: string;
        index: number;
        sourceUrl: string;
      }>;

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Bilder gefunden aber konnten nicht heruntergeladen werden. CDN blockiert möglicherweise Server-Anfragen." },
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
