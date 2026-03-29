/**
 * GET /api/openclaw/carousels/:id/slides/zip
 *
 * Renders all slides of a carousel as PNGs and returns them as a ZIP file.
 * Requires Openclaw API key (X-Openclaw-Key header).
 *
 * Usage: GET /api/openclaw/carousels/CAROUSEL_ID/slides/zip
 * Returns: application/zip with files slide-1.png, slide-2.png, ...
 */
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { validateOpenclaw } from "@/lib/openclaw-auth";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import { renderSlideToPng, RESOLUTION_WIDTHS, type ResolutionPreset } from "@/lib/render-slide";
import type { Slide } from "@/store/canvasStore";
import { parseSlidesPayload } from "@/lib/slides-payload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  const { id } = await params;

  try {
    const db = getDb();
    const { data: carousel } = await db
      .from("Carousel")
      .select("slidesJson, title, userId")
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID)
      .single();

    if (!carousel) {
      return new Response("Carousel not found", { status: 404 });
    }

    const { slides, grain: savedGrain } = parseSlidesPayload(carousel.slidesJson);

    if (slides.length === 0) {
      return new Response("Carousel has no slides", { status: 400 });
    }

    // Query params override saved grain (omit param = use saved template value)
    const clamp = (v: string | null, def: number) => {
      if (v === null) return def;
      const n = Number(v);
      return Number.isNaN(n) ? def : Math.max(0, Math.min(100, n));
    };
    const grainIntensity = req.nextUrl.searchParams.has("grain")
      ? clamp(req.nextUrl.searchParams.get("grain"), savedGrain.intensity)
      : savedGrain.intensity;
    const grainSize      = req.nextUrl.searchParams.has("grainSize")
      ? clamp(req.nextUrl.searchParams.get("grainSize"), savedGrain.size)
      : savedGrain.size;
    const grainDensity   = req.nextUrl.searchParams.has("grainDensity")
      ? clamp(req.nextUrl.searchParams.get("grainDensity"), savedGrain.density)
      : savedGrain.density;
    const grainSharpness = req.nextUrl.searchParams.has("grainSharpness")
      ? clamp(req.nextUrl.searchParams.get("grainSharpness"), savedGrain.sharpness)
      : savedGrain.sharpness;

    const resolutionPreset = req.nextUrl.searchParams.get("resolution") as ResolutionPreset | null;
    const slideWidth = RESOLUTION_WIDTHS[resolutionPreset ?? "2K"] ?? RESOLUTION_WIDTHS["2K"];

    const zip = new JSZip();
    const safeTitle = (carousel.title ?? "carousel").replace(/[^a-z0-9_\-]/gi, "-").toLowerCase();

    for (let i = 0; i < slides.length; i++) {
      const buffer = await renderSlideToPng(slides[i], grainIntensity, grainSize, grainDensity, grainSharpness, slideWidth);
      zip.file(`slide-${i + 1}.png`, buffer);
    }

    const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    return new Response(zipUint8.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Openclaw ZIP error:", err);
    return new Response("Render failed", { status: 500 });
  }
}
