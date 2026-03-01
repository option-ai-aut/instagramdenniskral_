/**
 * POST /api/instagram/import
 *
 * Fetches images from a public Instagram post URL.
 * Supports single posts and carousels.
 *
 * Requires INSTAGRAM_SESSION_ID environment variable (sessionid cookie from your
 * logged-in Instagram browser session). Without it, Instagram blocks all server requests.
 *
 * How to get your session ID:
 *   1. Open Instagram in Chrome, log in as @denniskral_
 *   2. Open DevTools → Application → Cookies → https://www.instagram.com
 *   3. Copy the value of the "sessionid" cookie
 *   4. Add to .env.local: INSTAGRAM_SESSION_ID=your_value_here
 *   5. Also copy "X-IG-App-ID" from any Instagram network request and add:
 *      INSTAGRAM_APP_ID=your_value_here  (default: 936619743392459)
 *
 * Body: { url: string }
 * Response: { images: [{ base64, mimeType, index }], isCarousel: boolean, postUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const DEFAULT_APP_ID = "936619743392459";

function getInstagramHeaders(): HeadersInit {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  const appId = process.env.INSTAGRAM_APP_ID ?? DEFAULT_APP_ID;
  const ua =
    process.env.INSTAGRAM_USER_AGENT ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  const headers: Record<string, string> = {
    "User-Agent": ua,
    "X-IG-App-ID": appId,
    "X-FB-LSD": "AVqbxe3J_YA",
    "X-ASBD-ID": "129477",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
    "Referer": "https://www.instagram.com/",
    "Origin": "https://www.instagram.com",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };

  if (sessionId) {
    headers["Cookie"] = `sessionid=${sessionId}; ig_did=1; csrftoken=1; ds_user_id=1`;
  }

  return headers;
}

function extractShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** Pick highest-resolution candidate from image_versions2 */
function bestImageUrl(
  candidates: Array<{ url: string; width: number; height: number }>
): string | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    (c.width ?? 0) > (best.width ?? 0) ? c : best
  ).url;
}

/** Fetch via Instagram's private JSON endpoint (?__a=1&__d=dis) */
async function fetchViaPrivateApi(shortcode: string): Promise<string[] | null> {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  if (!sessionId) return null; // won't work without a session

  const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
  try {
    const res = await fetch(url, {
      headers: getInstagramHeaders(),
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`Instagram private API: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const item = json?.items?.[0];
    if (!item) return null;

    const imageUrls: string[] = [];

    if (item.product_type === "carousel_container" && Array.isArray(item.carousel_media)) {
      // Carousel post
      for (const media of item.carousel_media) {
        const candidates = media?.image_versions2?.candidates ?? [];
        const url = bestImageUrl(candidates);
        if (url) imageUrls.push(url);
      }
    } else {
      // Single image post
      const candidates = item?.image_versions2?.candidates ?? [];
      const url = bestImageUrl(candidates);
      if (url) imageUrls.push(url);
      // Fallback for video posts (use thumbnail)
      if (imageUrls.length === 0 && item?.thumbnail_url) {
        imageUrls.push(item.thumbnail_url as string);
      }
    }

    return imageUrls.length > 0 ? imageUrls : null;
  } catch (err) {
    console.error("Instagram private API error:", err);
    return null;
  }
}

/** Fetch via Instagram GraphQL API (no cookie needed, but often returns null for non-logged-in) */
async function fetchViaGraphQL(shortcode: string): Promise<string[] | null> {
  try {
    const graphql = new URL("https://www.instagram.com/api/graphql");
    graphql.searchParams.set("variables", JSON.stringify({ shortcode }));
    graphql.searchParams.set("doc_id", "10015901848480474");
    graphql.searchParams.set("lsd", "AVqbxe3J_YA");

    const res = await fetch(graphql.toString(), {
      method: "POST",
      headers: {
        ...getInstagramHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;
    const json = await res.json();
    const media = json?.data?.xdt_shortcode_media;
    if (!media) return null;

    const urls: string[] = [];

    // Carousel
    const edges: Array<{ node?: { display_url?: string; display_resources?: Array<{ src: string; config_width: number }> } }> =
      media?.edge_sidecar_to_children?.edges ?? [];
    if (edges.length > 0) {
      for (const edge of edges) {
        // Prefer highest-res display_resource
        const resources = edge?.node?.display_resources ?? [];
        const best = resources.sort((a, b) => b.config_width - a.config_width)[0];
        const url = best?.src ?? edge?.node?.display_url;
        if (url) urls.push(url);
      }
    } else if (media.display_url) {
      urls.push(media.display_url as string);
    }

    return urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}

/** oEmbed fallback – at most 1 image, low res */
async function fetchViaOembed(postUrl: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}&maxwidth=1080`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.thumbnail_url) return [data.thumbnail_url as string];
  } catch { /* fall through */ }
  return [];
}

async function downloadImage(
  url: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": "https://www.instagram.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    if (!mimeType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return null; // skip tiny/blank images
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, mimeType };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Inform client if no session is configured
  if (!process.env.INSTAGRAM_SESSION_ID) {
    return NextResponse.json(
      {
        error: "INSTAGRAM_SESSION_ID nicht konfiguriert",
        setupRequired: true,
        instructions: [
          "1. Öffne Instagram.com in Chrome und logge dich als @denniskral_ ein",
          "2. Öffne DevTools (F12) → Application → Cookies → https://www.instagram.com",
          "3. Kopiere den Wert des 'sessionid' Cookies",
          "4. Füge ihn in .env.local ein: INSTAGRAM_SESSION_ID=dein_wert",
          "5. Füge ihn auch in Vercel → Settings → Environment Variables ein",
          "6. Deploye neu",
        ],
      },
      { status: 503 }
    );
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
        {
          error:
            "Ungültige Instagram-URL. Unterstützte Formate:\n" +
            "• https://www.instagram.com/p/SHORTCODE/\n" +
            "• https://www.instagram.com/reel/SHORTCODE/",
        },
        { status: 400 }
      );
    }

    const postUrl = `https://www.instagram.com/p/${shortcode}/`;

    // Strategy 1: Private API with session cookie (best – gives full carousel)
    let rawUrls = await fetchViaPrivateApi(shortcode);

    // Strategy 2: GraphQL API (no cookie, often fails but worth trying)
    if (!rawUrls || rawUrls.length === 0) {
      console.log("Private API failed, trying GraphQL...");
      rawUrls = await fetchViaGraphQL(shortcode);
    }

    // Strategy 3: oEmbed (last resort, only 1 thumbnail)
    if (!rawUrls || rawUrls.length === 0) {
      console.log("GraphQL failed, trying oEmbed...");
      const oembed = await fetchViaOembed(postUrl);
      if (oembed.length > 0) rawUrls = oembed;
    }

    if (!rawUrls || rawUrls.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine Bilder gefunden. Mögliche Ursachen:\n" +
            "• Privater Account oder Post existiert nicht\n" +
            "• Instagram-Session abgelaufen → neuen sessionid-Cookie eintragen\n" +
            "• Instagram hat die IP temporär blockiert → in 30 Minuten nochmal versuchen",
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
        {
          error:
            "Bild-URLs gefunden, aber Download vom Instagram CDN blockiert.\n" +
            "Bitte nochmal versuchen – Instagram CDN-Links sind zeitlich begrenzt.",
        },
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
