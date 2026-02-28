/**
 * POST /api/openclaw/carousels
 *
 * Creates a new carousel based on a template (builtin or saved) and
 * applies text overrides to the specified slide elements.
 *
 * Request body:
 * {
 *   templateId: string,          // builtin: "progress" | "tip" | "luxury"  OR  saved carousel ID
 *   title?: string,              // optional title for the new carousel
 *   textOverrides?: Array<{
 *     slideIndex: number,        // 0-based slide index
 *     elementType: string,       // "header" | "subtitle" | "body" | "tag"
 *     text: string               // new text content
 *   }>
 * }
 *
 * Returns:
 * {
 *   carouselId: string,
 *   title: string,
 *   slideCount: number,
 *   slides: [...],
 *   slideImageUrls: string[],    // PNG download URLs for each slide
 *   viewUrl: string              // Open in canvas editor
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { validateOpenclaw } from "@/lib/openclaw-auth";
import { getDb, newId, now } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import type { Slide, TextElement } from "@/store/canvasStore";

const nanoid = () => Math.random().toString(36).slice(2, 11);

// Built-in template definitions (mirrors canvasStore.ts)
function getBuiltinTemplate(id: string): Slide[] | null {
  const templates: Record<string, Slide[]> = {
    progress: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #1a1224 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag", text: "BUILD IN PUBLIC", fontSize: 11, fontWeight: "semibold", color: "#a78bfa", align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header", text: "Was ich diese Woche gebaut habe", fontSize: 32, fontWeight: "extrabold", color: "#ffffff", align: "center", x: 50, y: 40 },
          { id: nanoid(), type: "subtitle", text: "Von 0 auf 1.000 Nutzer in 30 Tagen", fontSize: 16, fontWeight: "normal", color: "rgba(255,255,255,0.6)", align: "center", x: 50, y: 62 },
          { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
    tip: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #0f1a24 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag", text: "PRO TIPP", fontSize: 11, fontWeight: "semibold", color: "#34d399", align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header", text: "Dein Titel hier", fontSize: 34, fontWeight: "extrabold", color: "#ffffff", align: "center", x: 50, y: 40 },
          { id: nanoid(), type: "subtitle", text: "Kurze prägnante Beschreibung in 1-2 Sätzen.", fontSize: 15, fontWeight: "normal", color: "rgba(255,255,255,0.55)", align: "center", x: 50, y: 64 },
          { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
    luxury: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(160deg, #0a0a0f 0%, #1a1500 60%, #0a0a0f 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag", text: "LUXURY · CARS · LIFESTYLE", fontSize: 10, fontWeight: "semibold", color: "#fbbf24", align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header", text: "Dein Headline", fontSize: 36, fontWeight: "extrabold", color: "#ffffff", align: "center", x: 50, y: 42 },
          { id: nanoid(), type: "subtitle", text: "Subtitel oder Zitat kommt hier hin.", fontSize: 15, fontWeight: "normal", color: "rgba(255,255,255,0.5)", align: "center", x: 50, y: 63 },
          { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", color: "rgba(255,255,255,0.25)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
  };
  return templates[id] ?? null;
}

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://instagramdenniskral.vercel.app";

    return NextResponse.json({
      carousels: (carousels ?? []).map((c) => {
        const slides = Array.isArray(c.slidesJson) ? c.slidesJson : [];
        return {
          ...c,
          slideCount: slides.length,
          slideImageUrls: slides.map((_: unknown, i: number) =>
            `${baseUrl}/api/openclaw/carousels/${c.id}/slides/${i}/image.png`
          ),
          viewUrl: `${baseUrl}/canvas?load=${c.id}`,
        };
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const { templateId, title, textOverrides = [] } = body as {
      templateId: string;
      title?: string;
      textOverrides?: Array<{ slideIndex: number; elementType: string; text: string }>;
    };

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required. Call GET /api/openclaw/templates to see available templates." },
        { status: 400 }
      );
    }

    let slides: Slide[] | null = null;

    // Try builtin template first
    slides = getBuiltinTemplate(templateId);

    // If not builtin, try loading from saved carousels
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

    // Apply text overrides (immutable – avoids mutating template objects)
    const overrides = Array.isArray(textOverrides) ? textOverrides : [];
    if (overrides.length > 0) {
      slides = slides.map((slide, idx) => {
        const slideOverrides = overrides.filter(
          (o) => typeof o.slideIndex === "number" && o.slideIndex === idx && o.elementType && typeof o.text === "string"
        );
        if (slideOverrides.length === 0) return slide;
        return {
          ...slide,
          elements: (slide.elements as TextElement[]).map((el) => {
            const override = slideOverrides.find((o) => o.elementType === el.type);
            return override ? { ...el, text: override.text.slice(0, 500) } : el;
          }),
        };
      });
    }

    // Generate IDs for all slides/elements
    const finalSlides = slides.map((sl) => ({
      ...sl,
      id: nanoid(),
      elements: sl.elements.map((el) => ({ ...el, id: nanoid() })),
    }));

    // Save to database
    const carouselTitle = typeof title === "string" && title.trim()
      ? title.trim().slice(0, 200)
      : "Openclaw Carousel";

    const ts = now();
    const db = getDb();
    await db.from("User").upsert({ id: SYSTEM_USER_ID, email: "dennis@denniskral.com" }, { onConflict: "id" });

    const { data: carousel, error } = await db
      .from("Carousel")
      .insert({ id: newId(), userId: SYSTEM_USER_ID, title: carouselTitle, slidesJson: finalSlides, createdAt: ts, updatedAt: ts })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://instagramdenniskral.vercel.app";
    const slideImageUrls = finalSlides.map((_: unknown, i: number) =>
      `${baseUrl}/api/openclaw/carousels/${carousel.id}/slides/${i}/image.png`
    );

    return NextResponse.json({
      carouselId: carousel.id,
      title: carousel.title,
      slideCount: finalSlides.length,
      slideImageUrls,
      viewUrl: `${baseUrl}/canvas?load=${carousel.id}`,
      slides: finalSlides.map((sl, i) => ({
        slideIndex: i,
        downloadUrl: slideImageUrls[i],
        elements: sl.elements.map((el: TextElement) => ({ type: el.type, text: el.text })),
      })),
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/openclaw/carousels error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
