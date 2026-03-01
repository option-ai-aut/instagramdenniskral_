/**
 * POST /api/instagram/import
 *
 * Fetches images from a public Instagram post URL.
 * Supports single posts and carousels.
 *
 * Body: { url: string, sessionId?: string }
 *   sessionId: Instagram "sessionid" cookie value. Can be set via the app's
 *              Instagram Settings (stored in browser localStorage). Without it,
 *              Instagram blocks carousel requests.
 *
 * Response: { images: [{ base64, mimeType, index }], isCarousel: boolean, postUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const DEFAULT_APP_ID = "936619743392459";

function makeHeaders(sessionId?: string): Record<string, string> {
  const appId = process.env.INSTAGRAM_APP_ID ?? DEFAULT_APP_ID;
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

  // Use client-provided session OR fall back to env var
  const session = sessionId || process.env.INSTAGRAM_SESSION_ID;
  if (session) {
    headers["Cookie"] = `sessionid=${session}; ig_did=1; csrftoken=1; ds_user_id=1`;
  }

  return headers;
}

function extractShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

function bestImageUrl(
  candidates: Array<{ url: string; width: number; height: number }>
): string | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    (c.width ?? 0) > (best.width ?? 0) ? c : best
  ).url;
}

/** Fetch via Instagram's private JSON endpoint (?__a=1&__d=dis) — needs session cookie */
async function fetchViaPrivateApi(shortcode: string, sessionId?: string): Promise<string[] | null> {
  const session = sessionId || process.env.INSTAGRAM_SESSION_ID;
  if (!session) return null;

  const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
  try {
    const res = await fetch(url, {
      headers: makeHeaders(session),
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`Instagram private API: HTTP ${res.status}`);
      return null;
    }

    const text = await res.text();
    // Instagram sometimes returns HTML (login wall) instead of JSON
    if (text.trim().startsWith("<")) {
      console.warn("Instagram returned HTML instead of JSON – session cookie expired?");
      return null;
    }

    const json = JSON.parse(text);
    const item = json?.items?.[0];
    if (!item) return null;

    const imageUrls: string[] = [];

    if (
      (item.product_type === "carousel_container" || item.media_type === 8) &&
      Array.isArray(item.carousel_media)
    ) {
      for (const media of item.carousel_media) {
        const candidates = media?.image_versions2?.candidates ?? [];
        const u = bestImageUrl(candidates);
        if (u) imageUrls.push(u);
      }
    } else {
      const candidates = item?.image_versions2?.candidates ?? [];
      const u = bestImageUrl(candidates);
      if (u) imageUrls.push(u);
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

/** Fetch via Instagram GraphQL API — no cookie needed but often fails for carousels */
async function fetchViaGraphQL(shortcode: string, sessionId?: string): Promise<string[] | null> {
  try {
    const graphql = new URL("https://www.instagram.com/api/graphql");
    graphql.searchParams.set("variables", JSON.stringify({ shortcode }));
    graphql.searchParams.set("doc_id", "10015901848480474");
    graphql.searchParams.set("lsd", "AVqbxe3J_YA");

    const res = await fetch(graphql.toString(), {
      method: "POST",
      headers: {
        ...makeHeaders(sessionId),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;
    const text = await res.text();
    if (text.trim().startsWith("<")) return null;

    const json = JSON.parse(text);
    const media = json?.data?.xdt_shortcode_media;
    if (!media) return null;

    const urls: string[] = [];

    const edges: Array<{
      node?: {
        display_url?: string;
        display_resources?: Array<{ src: string; config_width: number }>;
      };
    }> = media?.edge_sidecar_to_children?.edges ?? [];

    if (edges.length > 0) {
      for (const edge of edges) {
        const resources = edge?.node?.display_resources ?? [];
        const best = resources.sort((a, b) => b.config_width - a.config_width)[0];
        const u = best?.src ?? edge?.node?.display_url;
        if (u) urls.push(u);
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
    if (buf.byteLength < 1000) return null;
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

  try {
    const body = await req.json();
    const url: string = body?.url;
    const sessionId: string | undefined = typeof body?.sessionId === "string" ? body.sessionId.trim() : undefined;

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

    // Determine effective session (client-provided takes priority over env)
    const effectiveSession = sessionId || process.env.INSTAGRAM_SESSION_ID;

    if (!effectiveSession) {
      return NextResponse.json(
        {
          error: "Instagram-Session nicht konfiguriert",
          setupRequired: true,
        },
        { status: 503 }
      );
    }

    // Strategy 1: Private API with session cookie (best – full carousel)
    let rawUrls = await fetchViaPrivateApi(shortcode, effectiveSession);

    // Strategy 2: GraphQL (with session, often helps)
    if (!rawUrls || rawUrls.length === 0) {
      console.log("Private API failed, trying GraphQL...");
      rawUrls = await fetchViaGraphQL(shortcode, effectiveSession);
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
            "Keine Bilder gefunden.\n\nMögliche Ursachen:\n" +
            "• Instagram-Session abgelaufen → neuen sessionid-Cookie eingeben\n" +
            "• Privater Account oder Post gelöscht\n" +
            "• Instagram hat die IP temporär blockiert",
        },
        { status: 422 }
      );
    }

    // Cap at 20 images and download in parallel
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
            "Bild-URLs gefunden, aber Download blockiert.\n" +
            "Instagram CDN-Links sind zeitlich begrenzt – nochmal versuchen.",
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
