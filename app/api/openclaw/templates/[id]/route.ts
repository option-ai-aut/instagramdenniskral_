/**
 * GET /api/openclaw/templates/:id
 *
 * Returns the exact structure of one template so Openclaw knows
 * which text elements exist on each slide before filling them in.
 *
 * Works for both builtin IDs ("progress", "tip", "luxury")
 * and saved carousel IDs (UUIDs).
 */
import { NextRequest, NextResponse } from "next/server";
import { validateOpenclaw } from "@/lib/openclaw-auth";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import type { Slide, TextElement } from "@/store/canvasStore";

const BUILTIN_TEMPLATES: Record<string, {
  name: string;
  description: string;
  slides: Array<{ slideIndex: number; aspectRatio: string; background: string; elements: Array<{ type: string; defaultText: string; fontSize: number; position_y_percent: number; align: string; note: string }> }>;
}> = {
  progress: {
    name: "Progress Update",
    description: "Build-in-Public style post – suited for weekly updates, milestones, metrics.",
    slides: [
      {
        slideIndex: 0,
        aspectRatio: "4:5",
        background: "dark purple gradient",
        elements: [
          { type: "tag",      defaultText: "BUILD IN PUBLIC", fontSize: 11, position_y_percent: 15, align: "center", note: "Short label, caps recommended. E.g. 'WEEK 3 UPDATE'" },
          { type: "header",   defaultText: "Was ich diese Woche gebaut habe", fontSize: 32, position_y_percent: 40, align: "center", note: "Main headline. Keep it concise, 5-10 words." },
          { type: "subtitle", defaultText: "Von 0 auf 1.000 Nutzer in 30 Tagen", fontSize: 16, position_y_percent: 62, align: "center", note: "Supporting detail or metric. 1-2 lines." },
          { type: "body",     defaultText: "@denniskral_", fontSize: 12, position_y_percent: 88, align: "center", note: "Handle or CTA. Usually left as @denniskral_" },
        ],
      },
    ],
  },
  tip: {
    name: "Hilfreicher Tipp",
    description: "Single actionable tip or insight. Green accent colour.",
    slides: [
      {
        slideIndex: 0,
        aspectRatio: "4:5",
        background: "dark blue gradient",
        elements: [
          { type: "tag",      defaultText: "PRO TIPP", fontSize: 11, position_y_percent: 15, align: "center", note: "Short category label. E.g. 'PRO TIP', 'TRICK', 'HACK'" },
          { type: "header",   defaultText: "Dein Titel hier", fontSize: 34, position_y_percent: 40, align: "center", note: "Bold statement or question. 3-8 words." },
          { type: "subtitle", defaultText: "Kurze prägnante Beschreibung in 1-2 Sätzen.", fontSize: 15, position_y_percent: 64, align: "center", note: "Explanation of the tip. 1-3 sentences." },
          { type: "body",     defaultText: "@denniskral_", fontSize: 12, position_y_percent: 88, align: "center", note: "Handle or CTA." },
        ],
      },
    ],
  },
  luxury: {
    name: "Luxury Lifestyle",
    description: "Premium gold-accented post for cars, watches, travel, entrepreneurship.",
    slides: [
      {
        slideIndex: 0,
        aspectRatio: "4:5",
        background: "dark gold gradient",
        elements: [
          { type: "tag",      defaultText: "LUXURY · CARS · LIFESTYLE", fontSize: 10, position_y_percent: 15, align: "center", note: "Category label, use · as separator. E.g. 'PORSCHE · DUBAI · LIFESTYLE'" },
          { type: "header",   defaultText: "Dein Headline", fontSize: 36, position_y_percent: 42, align: "center", note: "Aspirational headline. 3-7 words." },
          { type: "subtitle", defaultText: "Subtitel oder Zitat kommt hier hin.", fontSize: 15, position_y_percent: 63, align: "center", note: "Short quote or teaser. 1-2 sentences." },
          { type: "body",     defaultText: "@denniskral_", fontSize: 12, position_y_percent: 88, align: "center", note: "Handle or CTA." },
        ],
      },
    ],
  },
};

function describeSlide(slide: Slide, index: number) {
  return {
    slideIndex: index,
    aspectRatio: slide.aspectRatio ?? "4:5",
    background: slide.background?.type === "gradient" ? "gradient" : slide.background?.type === "solid" ? `solid (${slide.background.color})` : "image",
    elements: (slide.elements as TextElement[]).map((el) => ({
      type: el.type,
      currentText: el.text,
      fontSize: el.fontSize,
      position_y_percent: el.y,
      align: el.align,
      note: `Override with textOverrides: { slideIndex: ${index}, elementType: "${el.type}", text: "..." }`,
    })),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  const { id } = await params;

  // Check builtin first
  const builtin = BUILTIN_TEMPLATES[id];
  if (builtin) {
    return NextResponse.json({
      id,
      name: builtin.name,
      description: builtin.description,
      type: "builtin",
      slideCount: builtin.slides.length,
      slides: builtin.slides,
      usage: {
        hint: `Pass this templateId to POST /api/openclaw/carousels with your textOverrides`,
        exampleRequest: {
          templateId: id,
          title: "Mein Post Titel",
          textOverrides: builtin.slides.flatMap((sl) =>
            sl.elements
              .filter((el) => el.type !== "body")
              .map((el) => ({
                slideIndex: sl.slideIndex,
                elementType: el.type,
                text: `<Dein ${el.type} text hier>`,
              }))
          ),
        },
      },
    });
  }

  // Try saved carousel
  try {
    const db = getDb();
    const { data: carousel } = await db
      .from("Carousel")
      .select("id, title, slidesJson, updatedAt")
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID)
      .single();

    if (!carousel) {
      return NextResponse.json(
        { error: `Template '${id}' not found. Use GET /api/openclaw/templates to list all available templates.` },
        { status: 404 }
      );
    }

    const slides: Slide[] = Array.isArray(carousel.slidesJson) ? carousel.slidesJson : [];
    const describedSlides = slides.map((sl, i) => describeSlide(sl, i));

    return NextResponse.json({
      id: carousel.id,
      name: carousel.title,
      description: "Saved carousel template",
      type: "saved",
      slideCount: slides.length,
      updatedAt: carousel.updatedAt,
      slides: describedSlides,
      usage: {
        hint: `Pass this templateId (${carousel.id}) to POST /api/openclaw/carousels`,
        exampleRequest: {
          templateId: carousel.id,
          title: "Mein neuer Titel",
          textOverrides: describedSlides.flatMap((sl) =>
            sl.elements.map((el) => ({
              slideIndex: sl.slideIndex,
              elementType: el.type,
              text: `<Dein ${el.type} text>`,
            }))
          ),
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
