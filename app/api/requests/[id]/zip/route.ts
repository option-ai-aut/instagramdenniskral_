/**
 * Re-renders a logged Openclaw request as a ZIP on demand.
 * Fetches the stored requestBody from the OpenlawRequest table and
 * calls the same rendering pipeline used at request time.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { nanoid } from "@/lib/nanoid";
import type { Slide, TextElement } from "@/store/canvasStore";
import { renderSlideToPng } from "@/lib/render-slide";
import { parseSlidesPayload } from "@/lib/slides-payload";
import JSZip from "jszip";

const DEFAULT_GRAIN_ZERO = { intensity: 0, size: 40, density: 50, sharpness: 50 };

function getBuiltinSlides(id: string): Slide[] | null {
  const defs: Record<string, () => Slide[]> = {
    progress: () => [{
      id: nanoid(), background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #1a1224 100%)" }, aspectRatio: "4:5",
      elements: [
        { id: nanoid(), type: "tag",      text: "BUILD IN PUBLIC",                    fontSize: 11, fontWeight: "semibold",  fontFamily: "Montserrat",      color: "#60a5fa",               align: "center", x: 50, y: 15 },
        { id: nanoid(), type: "header",   text: "Was ich diese Woche gebaut habe",    fontSize: 32, fontWeight: "extrabold", fontFamily: "Playfair Display", color: "#ffffff",               align: "center", x: 50, y: 40 },
        { id: nanoid(), type: "subtitle", text: "Von 0 auf 1.000 Nutzer in 30 Tagen", fontSize: 16, fontWeight: "normal",    fontFamily: "Inter",            color: "rgba(255,255,255,0.6)", align: "center", x: 50, y: 62 },
        { id: nanoid(), type: "body",     text: "@denniskral_",                       fontSize: 12, fontWeight: "medium",    fontFamily: "Inter",            color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
      ],
    }],
    tip: () => [{
      id: nanoid(), background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #0f1a24 100%)" }, aspectRatio: "4:5",
      elements: [
        { id: nanoid(), type: "tag",      text: "PRO TIPP",                                      fontSize: 11, fontWeight: "semibold",  fontFamily: "Montserrat", color: "#34d399",               align: "center", x: 50, y: 15 },
        { id: nanoid(), type: "header",   text: "Dein Titel hier",                               fontSize: 34, fontWeight: "extrabold", fontFamily: "Bebas Neue",  color: "#ffffff",               align: "center", x: 50, y: 40 },
        { id: nanoid(), type: "subtitle", text: "Kurze prägnante Beschreibung in 1-2 Sätzen.",   fontSize: 15, fontWeight: "normal",    fontFamily: "Poppins",     color: "rgba(255,255,255,0.55)",align: "center", x: 50, y: 64 },
        { id: nanoid(), type: "body",     text: "@denniskral_",                                  fontSize: 12, fontWeight: "medium",    fontFamily: "Inter",       color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
      ],
    }],
    luxury: () => [{
      id: nanoid(), background: { type: "gradient", gradient: "linear-gradient(160deg, #0a0a0f 0%, #1a1500 60%, #0a0a0f 100%)" }, aspectRatio: "4:5",
      elements: [
        { id: nanoid(), type: "tag",      text: "LUXURY · CARS · LIFESTYLE",           fontSize: 10, fontWeight: "semibold", fontFamily: "Cinzel",             color: "#fbbf24",               align: "center", x: 50, y: 15 },
        { id: nanoid(), type: "header",   text: "Dein Headline",                       fontSize: 36, fontWeight: "bold",     fontFamily: "Cormorant Garamond", color: "#ffffff",               align: "center", x: 50, y: 42 },
        { id: nanoid(), type: "subtitle", text: "Subtitel oder Zitat kommt hier hin.", fontSize: 15, fontWeight: "normal",   fontFamily: "Lora",               color: "rgba(255,255,255,0.5)", align: "center", x: 50, y: 63 },
        { id: nanoid(), type: "body",     text: "@denniskral_",                        fontSize: 12, fontWeight: "medium",   fontFamily: "Inter",              color: "rgba(255,255,255,0.25)",align: "center", x: 50, y: 88 },
      ],
    }],
  };
  return defs[id] ? defs[id]() : null;
}

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

    const body = (record.requestbody ?? record.requestBody) as {
      tag?: string | null;
      body?: string | null;
      slides?: Array<{ header?: string; subtitle?: string }> | null;
      textOverrides?: Array<{ slideIndex: number; elementType: string; text: string }> | null;
      grainIntensity?: number;
    };

    const tmplId = (record.templateid ?? record.templateId) as string;

    // Try builtin templates first, then DB
    let templateSlides: Slide[];
    let savedGrain = { ...DEFAULT_GRAIN_ZERO };

    const builtinSlides = getBuiltinSlides(tmplId);
    if (builtinSlides) {
      templateSlides = builtinSlides;
    } else {
      const { data: carousel } = await db
        .from("Carousel")
        .select("slidesJson")
        .eq("id", tmplId)
        .eq("userId", SYSTEM_USER_ID)
        .single();

      if (!carousel) {
        return NextResponse.json({ error: "Template nicht mehr vorhanden" }, { status: 404 });
      }
      const parsed = parseSlidesPayload(carousel.slidesJson);
      templateSlides = parsed.slides;
      savedGrain = parsed.grain;
    }

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
    const safeTitle = ((record.title as string | null) ?? (record.templatetitle as string | null) ?? "carousel")
      .replace(/[^a-z0-9_\-]/gi, "-").toLowerCase() || "carousel";
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
