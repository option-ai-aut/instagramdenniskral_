/**
 * GET /api/openclaw/carousels/:id/slides/:index/image.png
 * Renders a single slide of a saved carousel template as PNG.
 * Requires Openclaw API key.
 */
import { NextRequest } from "next/server";
import { validateOpenclaw } from "@/lib/openclaw-auth";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import { renderSlideToPng } from "@/lib/render-slide";
import type { Slide } from "@/store/canvasStore";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  const { id, index } = await params;
  const slideIndex = parseInt(index, 10);

  if (isNaN(slideIndex) || slideIndex < 0) {
    return new Response("Invalid slide index", { status: 400 });
  }

  try {
    const db = getDb();
    const { data: carousel } = await db
      .from("Carousel")
      .select("slidesJson, title, userId")
      .eq("id", id)
      .single();

    if (!carousel || carousel.userId !== SYSTEM_USER_ID) {
      return new Response("Not found", { status: 404 });
    }

    const slides: Slide[] = Array.isArray(carousel.slidesJson) ? carousel.slidesJson : [];
    const slide = slides[slideIndex];

    if (!slide) {
      return new Response(
        `Slide ${slideIndex} not found. Carousel has ${slides.length} slides.`,
        { status: 404 }
      );
    }

    const buffer = await renderSlideToPng(slide);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="slide-${slideIndex + 1}.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Slide PNG error:", err);
    return new Response("Render error", { status: 500 });
  }
}
