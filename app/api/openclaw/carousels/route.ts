/**
 * Openclaw Carousel API
 *
 * GET  /api/openclaw/carousels
 *   Lists all saved carousels (templates Dennis created in the canvas editor).
 *   Openclaw uses these IDs as templateId when generating posts.
 *
 * POST /api/openclaw/carousels
 *   Generates slide images from a template + text overrides.
 *   Returns a ZIP file of all rendered PNGs directly – NO database entry is created.
 *
 *   Body: {
 *     templateId: string,          // builtin: "progress"|"tip"|"luxury"  OR saved carousel ID
 *     title?: string,              // used as ZIP filename only
 *     grainIntensity?: number,     // 0-100, grain texture strength (default 0)
 *     textOverrides?: Array<{
 *       slideIndex: number,
 *       elementType: string,       // "header"|"subtitle"|"body"|"tag"
 *       text: string
 *     }>
 *   }
 *   Returns: application/zip  (slide-1.png, slide-2.png, ...)
 */
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { validateOpenclaw } from "@/lib/openclaw-auth";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import { renderSlideToPng } from "@/lib/render-slide";
import type { Slide, TextElement } from "@/store/canvasStore";
import { nanoid } from "@/lib/nanoid";

export const runtime = "nodejs";
export const maxDuration = 60;

// Built-in template definitions (mirrors canvasStore.ts – fonts are fixed per template)
function getBuiltinTemplate(id: string): Slide[] | null {
  const templates: Record<string, Slide[]> = {
    progress: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #1a1224 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag",      text: "BUILD IN PUBLIC",                    fontSize: 11, fontWeight: "semibold", fontFamily: "Montserrat",       color: "#60a5fa",              align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header",   text: "Was ich diese Woche gebaut habe",    fontSize: 32, fontWeight: "extrabold",fontFamily: "Playfair Display",  color: "#ffffff",              align: "center", x: 50, y: 40 },
          { id: nanoid(), type: "subtitle", text: "Von 0 auf 1.000 Nutzer in 30 Tagen", fontSize: 16, fontWeight: "normal",   fontFamily: "Inter",             color: "rgba(255,255,255,0.6)",align: "center", x: 50, y: 62 },
          { id: nanoid(), type: "body",     text: "@denniskral_",                       fontSize: 12, fontWeight: "medium",   fontFamily: "Inter",             color: "rgba(255,255,255,0.3)",align: "center", x: 50, y: 88 },
        ],
      },
    ],
    tip: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #0f1a24 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag",      text: "PRO TIPP",                                       fontSize: 11, fontWeight: "semibold", fontFamily: "Montserrat",  color: "#34d399",               align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header",   text: "Dein Titel hier",                                fontSize: 34, fontWeight: "extrabold",fontFamily: "Bebas Neue",   color: "#ffffff",               align: "center", x: 50, y: 40 },
          { id: nanoid(), type: "subtitle", text: "Kurze prägnante Beschreibung in 1-2 Sätzen.",    fontSize: 15, fontWeight: "normal",   fontFamily: "Poppins",      color: "rgba(255,255,255,0.55)",align: "center", x: 50, y: 64 },
          { id: nanoid(), type: "body",     text: "@denniskral_",                                   fontSize: 12, fontWeight: "medium",   fontFamily: "Inter",        color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
    luxury: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(160deg, #0a0a0f 0%, #1a1500 60%, #0a0a0f 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag",      text: "LUXURY · CARS · LIFESTYLE",            fontSize: 10, fontWeight: "semibold", fontFamily: "Cinzel",              color: "#fbbf24",               align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header",   text: "Dein Headline",                        fontSize: 36, fontWeight: "bold",     fontFamily: "Cormorant Garamond",  color: "#ffffff",               align: "center", x: 50, y: 42 },
          { id: nanoid(), type: "subtitle", text: "Subtitel oder Zitat kommt hier hin.",  fontSize: 15, fontWeight: "normal",   fontFamily: "Lora",                color: "rgba(255,255,255,0.5)", align: "center", x: 50, y: 63 },
          { id: nanoid(), type: "body",     text: "@denniskral_",                         fontSize: 12, fontWeight: "medium",   fontFamily: "Inter",               color: "rgba(255,255,255,0.25)",align: "center", x: 50, y: 88 },
        ],
      },
    ],
  };
  return templates[id] ?? null;
}

// ── GET: list saved templates (carousels Dennis created in the editor) ─────────

export async function GET(req: NextRequest) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  try {
    const db = getDb();
    const { data: carousels } = await db
      .from("Carousel")
      .select("id, title, slidesJson, createdAt, updatedAt")
      .eq("userId", SYSTEM_USER_ID)
      .order("updatedAt", { ascending: false });

    return NextResponse.json({
      templates: (carousels ?? []).map((c) => {
        const slides = Array.isArray(c.slidesJson) ? c.slidesJson : [];
        return {
          id: c.id,
          title: c.title,
          slideCount: slides.length,
          updatedAt: c.updatedAt,
        };
      }),
      note: "Use any id as templateId in POST /api/openclaw/carousels to generate images.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: generate ZIP from template (no database write) ───────────────────────

export async function POST(req: NextRequest) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const { templateId, title, textOverrides = [], grainIntensity = 0 } = body as {
      templateId: string;
      title?: string;
      textOverrides?: Array<{ slideIndex: number; elementType: string; text: string }>;
      grainIntensity?: number;
    };

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required. Call GET /api/openclaw/templates to see available templates." },
        { status: 400 }
      );
    }

    // Clamp grain
    const grain = Math.max(0, Math.min(100, Number(grainIntensity) || 0));

    // ── 1. Load template ───────────────────────────────────────────────────────
    let slides: Slide[] | null = getBuiltinTemplate(templateId);

    if (!slides) {
      const db = getDb();
      const { data: carousel } = await db
        .from("Carousel")
        .select("slidesJson, title")
        .eq("id", templateId)
        .eq("userId", SYSTEM_USER_ID)
        .single();

      if (!carousel) {
        return NextResponse.json(
          { error: `Template '${templateId}' not found. Use GET /api/openclaw/templates to list available templates.` },
          { status: 404 }
        );
      }
      slides = Array.isArray(carousel.slidesJson) ? carousel.slidesJson : [];
    }

    if (!slides || slides.length === 0) {
      return NextResponse.json({ error: "Template has no slides." }, { status: 400 });
    }

    // ── 2. Apply text overrides (immutable, locked elements are skipped) ───────
    const overrides = Array.isArray(textOverrides) ? textOverrides : [];
    if (overrides.length > 0) {
      slides = slides.map((slide, idx) => {
        const slideOverrides = overrides.filter(
          (o) => typeof o.slideIndex === "number" && o.slideIndex === idx &&
                 o.elementType && typeof o.text === "string"
        );
        if (slideOverrides.length === 0) return slide;
        return {
          ...slide,
          elements: (slide.elements as TextElement[]).map((el) => {
            const override = slideOverrides.find((o) => o.elementType === el.type);
            return (override && !el.locked)
              ? { ...el, text: override.text.replace(/\\n/g, "\n").slice(0, 500) }
              : el;
          }),
        };
      });
    }

    // Assign fresh IDs so the template objects are not mutated
    const finalSlides: Slide[] = slides.map((sl) => ({
      ...sl,
      id: nanoid(),
      elements: sl.elements.map((el) => ({ ...el, id: nanoid() })),
    }));

    // ── 3. Render all slides to PNG via Satori ─────────────────────────────────
    const zip = new JSZip();
    const safeTitle = (typeof title === "string" && title.trim()
      ? title.trim()
      : "carousel"
    ).replace(/[^a-z0-9_\-]/gi, "-").toLowerCase();

    for (let i = 0; i < finalSlides.length; i++) {
      const buffer = await renderSlideToPng(finalSlides[i], grain);
      zip.file(`${safeTitle}-slide-${i + 1}.png`, buffer);
    }

    const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    // ── 4. Return ZIP directly (no DB save) ───────────────────────────────────
    return new Response(zipUint8.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "X-Slide-Count": String(finalSlides.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/openclaw/carousels error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
