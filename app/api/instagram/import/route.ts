/**
 * POST /api/instagram/import
 *
 * Fetches images from a public Instagram post URL using the Instagram mobile API.
 * Requires a valid Instagram sessionid cookie (set via app settings or INSTAGRAM_SESSION_ID env var).
 *
 * Body: { url: string, sessionId?: string }
 * Response: { images: [{ base64, mimeType, index }], isCarousel: boolean, postUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_APP_ID = "936619743392459";

/** Convert Instagram shortcode to numeric media ID */
function shortcodeToMediaId(shortcode: string): string {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = BigInt(0);
  for (const c of shortcode) {
    id = id * BigInt(64) + BigInt(CHARS.indexOf(c));
  }
  return id.toString();
}

/** Extract numeric user ID from sessionid cookie (first segment before %3A or :) */
function userIdFromSession(sessionId: string): string {
  const decoded = decodeURIComponent(sessionId);
  return decoded.split(":")[0] ?? "0";
}

function extractShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

function bestImageUrl(candidates: Array<{ url: string; width: number; height?: number }>): string | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.width ?? 0) > (best.width ?? 0) ? c : best).url;
}

/** Fetch via Instagram's mobile API (i.instagram.com) – most reliable with session cookie */
async function fetchViaMobileApi(shortcode: string, sessionId: string): Promise<string[] | null> {
  const mediaId = shortcodeToMediaId(shortcode);
  const userId = userIdFromSession(sessionId);

  const headers: Record<string, string> = {
    "User-Agent": "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 6; oriole; qcom; en_US; 458229258)",
    "X-IG-App-ID": DEFAULT_APP_ID,
    "X-IG-Device-ID": "android-abcdef1234567890",
    "Accept": "*/*",
    "Accept-Language": "de-DE,de;q=0.9",
    "Cookie": `sessionid=${sessionId}; ds_user_id=${userId}; csrftoken=missing`,
  };

  try {
    const res = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
      headers,
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`Instagram mobile API: HTTP ${res.status}`);
      return null;
    }

    const text = await res.text();
    if (text.trim().startsWith("<")) {
      console.warn("Instagram mobile API returned HTML – session expired?");
      return null;
    }

    const json = JSON.parse(text);
    const item = json?.items?.[0];
    if (!item) return null;

    const imageUrls: string[] = [];

    // Carousel (media_type 8)
    if (item.media_type === 8 && Array.isArray(item.carousel_media)) {
      for (const media of item.carousel_media) {
        const candidates = media?.image_versions2?.candidates ?? [];
        const u = bestImageUrl(candidates);
        if (u) imageUrls.push(u);
      }
    } else {
      // Single image or video thumbnail
      const candidates = item?.image_versions2?.candidates ?? [];
      const u = bestImageUrl(candidates);
      if (u) imageUrls.push(u);
      if (imageUrls.length === 0 && item?.thumbnail_url) {
        imageUrls.push(item.thumbnail_url as string);
      }
    }

    return imageUrls.length > 0 ? imageUrls : null;
  } catch (err) {
    console.error("Instagram mobile API error:", err);
    return null;
  }
}

/** Fallback: Instagram's web private endpoint */
async function fetchViaWebApi(shortcode: string, sessionId: string): Promise<string[] | null> {
  const userId = userIdFromSession(sessionId);
  const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "X-IG-App-ID": DEFAULT_APP_ID,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.instagram.com/",
        "Cookie": `sessionid=${sessionId}; ds_user_id=${userId}; csrftoken=missing`,
      },
      redirect: "follow",
    });

    if (!res.ok) return null;
    const text = await res.text();
    if (text.trim().startsWith("<")) return null;

    const json = JSON.parse(text);
    const item = json?.items?.[0];
    if (!item) return null;

    const imageUrls: string[] = [];
    if (item.media_type === 8 && Array.isArray(item.carousel_media)) {
      for (const media of item.carousel_media) {
        const u = bestImageUrl(media?.image_versions2?.candidates ?? []);
        if (u) imageUrls.push(u);
      }
    } else {
      const u = bestImageUrl(item?.image_versions2?.candidates ?? []);
      if (u) imageUrls.push(u);
    }

    return imageUrls.length > 0 ? imageUrls : null;
  } catch {
    return null;
  }
}

async function downloadImage(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
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
    return { base64: Buffer.from(buf).toString("base64"), mimeType };
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
    const body = await req.json() as Record<string, unknown>;
    const url = body?.url as string | undefined;
    const clientSessionId: string | undefined =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : undefined;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL fehlt" }, { status: 400 });
    }

    const cleanUrl = url.trim().split("?")[0].replace(/\/$/, "") + "/";
    const shortcode = extractShortcode(cleanUrl);

    if (!shortcode) {
      return NextResponse.json(
        { error: "Ungültige Instagram-URL.\nUnterstützte Formate:\n• https://www.instagram.com/p/SHORTCODE/\n• https://www.instagram.com/reel/SHORTCODE/" },
        { status: 400 }
      );
    }

    // Use client-provided session first, then fall back to env var
    const effectiveSession = clientSessionId || process.env.INSTAGRAM_SESSION_ID;

    if (!effectiveSession) {
      return NextResponse.json(
        { error: "Instagram-Session nicht konfiguriert", setupRequired: true },
        { status: 503 }
      );
    }

    const postUrl = `https://www.instagram.com/p/${shortcode}/`;

    // Strategy 1: Mobile API (most reliable)
    let rawUrls = await fetchViaMobileApi(shortcode, effectiveSession);

    // Strategy 2: Web private API fallback
    if (!rawUrls || rawUrls.length === 0) {
      console.log("Mobile API failed, trying web API...");
      rawUrls = await fetchViaWebApi(shortcode, effectiveSession);
    }

    if (!rawUrls || rawUrls.length === 0) {
      return NextResponse.json(
        {
          error: "Keine Bilder gefunden.\n\nMögliche Ursachen:\n• Instagram-Session abgelaufen → neuen Cookie eingeben\n• Privater Account oder Post gelöscht\n• Instagram blockiert diese IP temporär",
        },
        { status: 422 }
      );
    }

    // Download up to 20 images in parallel
    const urlsToFetch = rawUrls.slice(0, 20);
    const downloaded = await Promise.all(urlsToFetch.map((u) => downloadImage(u)));

    const images = downloaded
      .map((d, i) => (d ? { ...d, index: i, sourceUrl: urlsToFetch[i] } : null))
      .filter(Boolean) as Array<{ base64: string; mimeType: string; index: number; sourceUrl: string }>;

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Bild-URLs gefunden aber Download fehlgeschlagen.\nInstagram CDN-Links sind zeitlich begrenzt – nochmal versuchen." },
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
