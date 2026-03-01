/**
 * Re-renders a logged Openclaw request as a ZIP on demand.
 * Fetches the stored requestBody from the OpenlawRequest table and
 * calls the same rendering pipeline used at request time.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import { renderSlideToPng } from "@/lib/render-slide";
import { parseSlidesPayload } from "@/lib/slides-payload";
import { nanoid } from "@/lib/nanoid";
import type { Slide, TextElement } from "@/store/canvasStore";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function normalizeNewlines(text: string): string {
  return text
    .split("\u005C\u006E").join("\u000A")
    .split("\u002F\u006E").join("\u000A")
    .split("\u000D\u000A").join("\u000A")
    .split("\u000D").join("\u000A");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getDb();

    const { data: record, error } = await db
      .from("OpenlawRequest")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !record) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const body = record.requestBody as {
      tag?: string | null;
      body?: string | null;
      slides?: Array<{ header?: string; subtitle?: string }> | null;
      textOverrides?: Array<{ slideIndex: number; elementType: string; text: string }> | null;
      grainIntensity?: number;
    };

    // Load template
    const { data: carousel } = await db
      .from("Carousel")
      .select("slidesJson")
      .eq("id", record.templateId)
      .eq("userId", SYSTEM_USER_ID)
      .single();

    if (!carousel) {
      return NextResponse.json({ error: "Original template no longer exists" }, { status: 404 });
    }

    const { slides: templateSlides, grain: savedGrain } = parseSlidesPayload(carousel.slidesJson);

    // Re-apply overrides (same logic as the original request)
    const tag = body.tag ?? undefined;
    const bodyText = body.body ?? undefined;
    const slideOverrides = body.slides ?? undefined;
    const textOverrides = body.textOverrides ?? [];
    const grainIntensity = typeof body.grainIntensity === "number" ? body.grainIntensity : 0;

    const legacyMap: Record<number, Record<string, string>> = {};
    for (const o of textOverrides) {
      if (typeof o.slideIndex !== "number" || !o.elementType || typeof o.text !== "string") continue;
      if (!legacyMap[o.slideIndex]) legacyMap[o.slideIndex] = {};
      legacyMap[o.slideIndex][o.elementType] = o.text;
    }

    let slides: Slide[] = templateSlides.map((slide, idx) => {
      const legacySlide = legacyMap[idx] ?? {};
      const perSlide = Array.isArray(slideOverrides) ? (slideOverrides[idx] ?? {}) : {};
      const resolved: Record<string, string | undefined> = {
        tag:      typeof tag      === "string" ? tag      : undefined,
        body:     typeof bodyText === "string" ? bodyText : undefined,
        header:   typeof perSlide.header   === "string" ? perSlide.header   : legacySlide.header,
        subtitle: typeof perSlide.subtitle === "string" ? perSlide.subtitle : legacySlide.subtitle,
        ...( tag      === undefined && legacySlide.tag  ? { tag:  legacySlide.tag  } : {} ),
        ...( bodyText === undefined && legacySlide.body ? { body: legacySlide.body } : {} ),
      };
      const hasAny = Object.values(resolved).some((v) => v !== undefined);
      if (!hasAny) return slide;
      return {
        ...slide,
        elements: (slide.elements as TextElement[]).map((el) => {
          const text = resolved[el.type];
          return (text !== undefined && !el.locked)
            ? { ...el, text: normalizeNewlines(text).slice(0, 500) }
            : el;
        }),
      };
    });

    slides = slides.map((sl) => ({
      ...sl,
      id: nanoid(),
      elements: sl.elements.map((el) => ({ ...el, id: nanoid() })),
    }));

    const grain = {
      intensity: grainIntensity,
      size: savedGrain.size,
      density: savedGrain.density,
      sharpness: savedGrain.sharpness,
    };

    const zip = new JSZip();
    const safeTitle = (record.title as string) || "carousel";
    for (let i = 0; i < slides.length; i++) {
      const buf = await renderSlideToPng(slides[i], grain.intensity, grain.size, grain.density, grain.sharpness);
      zip.file(`${safeTitle}-slide-${i + 1}.png`, buf);
    }

    const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    return new Response(zipUint8.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "X-Slide-Count": String(slides.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
