/**
 * POST /api/canvas/export
 * Renders all slides server-side (Satori) and returns a ZIP file.
 * Requires app authentication.
 */
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAuth } from "@/lib/auth";
import { renderSlideToPng } from "@/lib/render-slide";
import type { Slide } from "@/store/canvasStore";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let slides: Slide[];
  let title: string;

  try {
    const body = await req.json();
    slides = Array.isArray(body.slides) ? body.slides : [];
    title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "carousel";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (slides.length === 0) {
    return NextResponse.json({ error: "No slides" }, { status: 400 });
  }

  if (slides.length > 20) {
    return NextResponse.json({ error: "Too many slides (max 20)" }, { status: 400 });
  }

  try {
    const zip = new JSZip();
    const safeTitle = title.replace(/[^a-z0-9_\-]/gi, "-").toLowerCase();

    for (let i = 0; i < slides.length; i++) {
      const buffer = await renderSlideToPng(slides[i]);
      zip.file(`${safeTitle}-slide-${i + 1}.png`, buffer);
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
    console.error("Export error:", err);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}
