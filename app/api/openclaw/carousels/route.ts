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
import { parseSlidesPayload } from "@/lib/slides-payload";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic"; // always read fresh from DB, never cached

/**
 * Normalise any newline variant Openclaw might send.
 * Uses Unicode code-point literals to avoid ALL regex-escaping ambiguity:
 *   \u005C = backslash (\)
 *   \u002F = forward slash (/)
 *   \u006E = letter n
 *   \u000A = real newline (LF)
 *   \u000D = carriage return (CR)
 */
function normalizeNewlines(text: string): string {
  return text
    // literal \n (backslash + n) → real newline
    .split("\u005C\u006E").join("\u000A")
    // literal /n (forward-slash + n) → real newline
    .split("\u002F\u006E").join("\u000A")
    // Windows CR+LF → LF
    .split("\u000D\u000A").join("\u000A")
    // lone CR → LF
    .split("\u000D").join("\u000A");
}

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
        const { slides } = parseSlidesPayload(c.slidesJson);
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
//
// New simplified format (recommended):
//   tag      – ONE string, applied to all slides (tag elements)
//   body     – ONE string, applied to all slides (body elements)
//   slides   – Array of { header?, subtitle? } per slide index
//
// Legacy format still works:
//   textOverrides – Array of { slideIndex, elementType, text }
//
// Both formats can be combined; new format takes precedence per field.

export async function POST(req: NextRequest) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  // ?dry=1  → return JSON showing applied overrides without rendering PNGs (debug)
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  try {
    // Rename outer var to avoid confusion with the 'body' JSON field
    let requestBody: Record<string, unknown> = {};
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const templateId    = requestBody.templateId    as string | undefined;
    const title         = requestBody.title         as string | undefined;
    const grainIntensity = typeof requestBody.grainIntensity === "number" ? requestBody.grainIntensity : 0;
    // ── new simplified format ────────────────────────────────────────────────
    const tag          = typeof requestBody.tag  === "string" ? requestBody.tag  : undefined;
    const bodyText     = typeof requestBody.body === "string" ? requestBody.body : undefined;
    const slideOverrides = Array.isArray(requestBody.slides)
      ? (requestBody.slides as Array<{ header?: string; subtitle?: string }>)
      : undefined;
    // ── legacy format (kept for backward compat) ────────────────────────────
    const textOverrides = Array.isArray(requestBody.textOverrides)
      ? (requestBody.textOverrides as Array<{ slideIndex: number; elementType: string; text: string }>)
      : [];

    console.log("[openclaw/POST] received:", JSON.stringify({
      templateId, title, grainIntensity,
      tag, bodyText,
      slideOverridesCount: slideOverrides?.length ?? 0,
      textOverridesCount: textOverrides.length,
    }));

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "templateId is required. Call GET /api/openclaw/templates to see available templates.", received: requestBody },
        { status: 400 }
      );
    }

    // ── 1. Load template (always fresh – no caching) ───────────────────────
    let slides: Slide[] | null = getBuiltinTemplate(templateId);
    let savedGrain = { intensity: 0, size: 40, density: 50, sharpness: 50 };

    if (!slides) {
      const db = getDb();
      const { data: carousel, error: dbErr } = await db
        .from("Carousel")
        .select("slidesJson, title")
        .eq("id", templateId)
        .eq("userId", SYSTEM_USER_ID)
        .single();

      if (dbErr || !carousel) {
        return NextResponse.json(
          { error: `Template '${templateId}' not found. Use GET /api/openclaw/templates to list available templates.` },
          { status: 404 }
        );
      }
      const parsed = parseSlidesPayload(carousel.slidesJson);
      slides = parsed.slides;
      savedGrain = parsed.grain;
    }

    const clampG = (v: unknown, def: number) =>
      typeof v === "number" ? Math.max(0, Math.min(100, v)) : def;
    const grain = {
      intensity: clampG(grainIntensity, savedGrain.intensity),
      size:      savedGrain.size,
      density:   savedGrain.density,
      sharpness: savedGrain.sharpness,
    };

    if (!slides || slides.length === 0) {
      return NextResponse.json({ error: "Template has no slides." }, { status: 400 });
    }

    // ── 2. Build merged override map ────────────────────────────────────────
    //  Priority: new format (tag/body/slides) > legacy textOverrides
    //  Locked elements are always skipped.

    // Step A: build legacy override lookup: [slideIdx][elementType] = text
    const legacyMap: Record<number, Record<string, string>> = {};
    for (const o of (Array.isArray(textOverrides) ? textOverrides : [])) {
      if (typeof o.slideIndex !== "number" || !o.elementType || typeof o.text !== "string") continue;
      if (!legacyMap[o.slideIndex]) legacyMap[o.slideIndex] = {};
      legacyMap[o.slideIndex][o.elementType] = o.text;
    }

    // Step B: apply all overrides to slides
    slides = slides.map((slide, idx) => {
      const legacySlide = legacyMap[idx] ?? {};

      // Per-slide from new slides[] format
      const perSlide = Array.isArray(slideOverrides) ? (slideOverrides[idx] ?? {}) : {};

      // Resolved text for each element type (new format wins)
      const resolved: Record<string, string | undefined> = {
        tag:      typeof tag      === "string" ? tag      : undefined,  // global
        body:     typeof bodyText === "string" ? bodyText : undefined,  // global
        header:   typeof perSlide.header   === "string" ? perSlide.header   : legacySlide.header,
        subtitle: typeof perSlide.subtitle === "string" ? perSlide.subtitle : legacySlide.subtitle,
        // legacy-only: allow body/tag per-slide via textOverrides when NOT given globally
        ...( tag      === undefined && legacySlide.tag      ? { tag:  legacySlide.tag      } : {} ),
        ...( bodyText === undefined && legacySlide.body     ? { body: legacySlide.body     } : {} ),
      };

      const hasAnyOverride = Object.values(resolved).some((v) => v !== undefined);
      if (!hasAnyOverride) return slide;

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

    console.log("[openclaw/POST] slides after overrides:", JSON.stringify(
      slides.map((sl, i) => ({
        slideIndex: i,
        elements: (sl.elements as TextElement[]).map((el) => ({ type: el.type, text: el.text, locked: el.locked })),
      }))
    ));

    // ?dry=1: return JSON showing applied text without rendering (useful for debugging)
    if (dryRun) {
      return NextResponse.json({
        debug: true,
        templateId,
        slideCount: slides.length,
        receivedParams: { tag, bodyText, slideOverridesCount: slideOverrides?.length ?? 0, textOverridesCount: textOverrides.length },
        slides: slides.map((sl, i) => ({
          slideIndex: i,
          elements: (sl.elements as TextElement[]).map((el) => ({ type: el.type, text: el.text, locked: !!el.locked })),
        })),
      });
    }

    // Assign fresh IDs so the template objects are not mutated
    const finalSlides: Slide[] = slides.map((sl) => ({
      ...sl,
      id: nanoid(),
      elements: sl.elements.map((el) => ({ ...el, id: nanoid() })),
    }));

    // ── 3. Render all slides to PNG via Satori ─────────────────────────────
    const zip = new JSZip();
    const safeTitle = (typeof title === "string" && title.trim()
      ? title.trim()
      : "carousel"
    ).replace(/[^a-z0-9_\-]/gi, "-").toLowerCase();

    for (let i = 0; i < finalSlides.length; i++) {
      const buffer = await renderSlideToPng(finalSlides[i], grain.intensity, grain.size, grain.density, grain.sharpness);
      zip.file(`${safeTitle}-slide-${i + 1}.png`, buffer);
    }

    const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    // ── 4. Log request to DB (non-blocking, never fails the request) ──────
    try {
      const db = getDb();
      const reqId = nanoid();
      // Resolve human-readable template title
      let tTitle: string | null = null;
      if (typeof title === "string" && title.trim()) {
        tTitle = title.trim();
      } else if (!getBuiltinTemplate(templateId)) {
        // Try to get title from DB (carousel was already loaded above, but we don't have it here)
        // Just skip – not critical
      }
      await db.from("OpenlawRequest").insert({
        id: reqId,
        templateId,
        templateTitle: tTitle,
        title: safeTitle,
        slideCount: finalSlides.length,
        requestBody: {
          tag: tag ?? null,
          body: bodyText ?? null,
          slides: slideOverrides ?? null,
          textOverrides: textOverrides.length > 0 ? textOverrides : null,
          grainIntensity,
        },
        userId: SYSTEM_USER_ID,
      });
    } catch (logErr) {
      console.warn("[openclaw] Failed to log request:", logErr);
    }

    // ── 5. Return ZIP directly (no DB save) ───────────────────────────────
    return new Response(zipUint8.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "X-Slide-Count": String(finalSlides.length),
        "X-Template-Id": templateId,
        "X-Overrides-Applied": JSON.stringify({
          tag: tag ?? null,
          body: bodyText ?? null,
          slidesCount: slideOverrides?.length ?? 0,
          legacyCount: textOverrides.length,
        }),
        "Cache-Control": "no-cache, no-store, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/openclaw/carousels error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
