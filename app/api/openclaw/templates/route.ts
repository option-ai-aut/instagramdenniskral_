/**
 * GET /api/openclaw/templates
 *
 * Returns all available templates:
 *  - Built-in templates (hardcoded in the canvas store)
 *  - Saved carousels from the database
 *
 * Authentication: Authorization: Bearer <OPENCLAW_API_KEY>
 */
import { NextRequest, NextResponse } from "next/server";
import { validateOpenclaw } from "@/lib/openclaw-auth";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";

const BUILTIN_TEMPLATES = [
  {
    id: "progress",
    name: "Progress Update",
    description: "Build-in-Public Update mit Header, Subtitle und @handle",
    slideCount: 1,
    type: "builtin",
    exampleTextElements: [
      { type: "tag", placeholder: "BUILD IN PUBLIC" },
      { type: "header", placeholder: "Was ich diese Woche gebaut habe" },
      { type: "subtitle", placeholder: "Von 0 auf 1.000 Nutzer in 30 Tagen" },
      { type: "body", placeholder: "@denniskral_" },
    ],
  },
  {
    id: "tip",
    name: "Hilfreicher Tipp",
    description: "Pro-Tipp Post mit markanter Überschrift",
    slideCount: 1,
    type: "builtin",
    exampleTextElements: [
      { type: "tag", placeholder: "PRO TIPP" },
      { type: "header", placeholder: "Dein Titel hier" },
      { type: "subtitle", placeholder: "Kurze prägnante Beschreibung in 1-2 Sätzen." },
      { type: "body", placeholder: "@denniskral_" },
    ],
  },
  {
    id: "luxury",
    name: "Luxury Lifestyle",
    description: "Gold-akzentuierter Post für Lifestyle/Cars/Entrepreneurship",
    slideCount: 1,
    type: "builtin",
    exampleTextElements: [
      { type: "tag", placeholder: "LUXURY · CARS · LIFESTYLE" },
      { type: "header", placeholder: "Dein Headline" },
      { type: "subtitle", placeholder: "Subtitel oder Zitat kommt hier hin." },
      { type: "body", placeholder: "@denniskral_" },
    ],
  },
];

export async function GET(req: NextRequest) {
  const authError = validateOpenclaw(req);
  if (authError) return authError;

  try {
    const db = getDb();
    const { data: carousels } = await db
      .from("Carousel")
      .select("id, title, slidesJson, updatedAt")
      .eq("userId", SYSTEM_USER_ID)
      .order("updatedAt", { ascending: false });

    const savedTemplates = (carousels ?? []).map((c) => {
      const slides = Array.isArray(c.slidesJson) ? c.slidesJson : [];
      return {
        id: c.id,
        name: c.title,
        description: `Gespeichertes Karussell mit ${slides.length} Slide(s)`,
        slideCount: slides.length,
        type: "saved",
        updatedAt: c.updatedAt,
        slides: slides.map((slide: { elements?: { type: string; text: string }[] }, i: number) => ({
          slideIndex: i,
          elements: (slide.elements ?? []).map((el: { type: string; text: string }) => ({
            type: el.type,
            currentText: el.text,
          })),
        })),
      };
    });

    return NextResponse.json({
      builtinTemplates: BUILTIN_TEMPLATES,
      savedTemplates,
      usage: {
        hint: "Use templateId from this list in POST /api/openclaw/carousels",
        textOverridesFormat: [
          { slideIndex: 0, elementType: "header", text: "Your new text" },
          { slideIndex: 0, elementType: "subtitle", text: "Your subtitle" },
        ],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
