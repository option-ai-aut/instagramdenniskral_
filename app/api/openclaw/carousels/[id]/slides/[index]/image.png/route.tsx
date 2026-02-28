/**
 * GET /api/openclaw/carousels/:id/slides/:index/image.png
 *
 * Renders a single carousel slide as a PNG image using Satori (next/og).
 * No auth required – URLs are non-guessable carousel IDs.
 * Rate: Returns 1080×1350 px PNG (4:5 ratio) or matches the slide's aspectRatio.
 */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { SYSTEM_USER_ID } from "@/lib/auth";
import type { Slide, TextElement } from "@/store/canvasStore";

export const runtime = "edge";

const W = 1080;

function getHeight(aspectRatio: string): number {
  if (aspectRatio === "1:1") return W;
  if (aspectRatio === "9:16") return Math.round(W * (16 / 9));
  return Math.round(W * (5 / 4)); // default 4:5
}

function fontWeightNum(fw: string): number {
  const map: Record<string, number> = {
    normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800,
  };
  return map[fw] ?? 400;
}

function buildBackground(slide: Slide): React.CSSProperties {
  const bg = slide.background;
  if (bg.type === "solid" && bg.color) return { backgroundColor: bg.color };
  if (bg.type === "gradient" && bg.gradient) {
    // Satori supports linear-gradient in backgroundImage
    return { backgroundImage: bg.gradient };
  }
  if (bg.type === "image" && bg.imageUrl) {
    return { backgroundImage: `url(${bg.imageUrl})`, backgroundSize: "cover" };
  }
  return { backgroundColor: "#0a0a0f" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
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

    // Allow access if it belongs to the system user (or public carousels)
    if (!carousel || carousel.userId !== SYSTEM_USER_ID) {
      return new Response("Not found", { status: 404 });
    }

    const slides: Slide[] = Array.isArray(carousel.slidesJson) ? carousel.slidesJson : [];
    const slide = slides[slideIndex];

    if (!slide) {
      return new Response(`Slide ${slideIndex} not found. Carousel has ${slides.length} slides.`, { status: 404 });
    }

    const height = getHeight(slide.aspectRatio ?? "4:5");
    const bgStyle = buildBackground(slide);

    // Build element JSX data
    const elements = (slide.elements ?? []) as TextElement[];

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: W,
            height,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            ...bgStyle,
          }}
        >
          {elements.map((el) => {
            const topPct = el.y ?? 50;
            const alignMap: Record<string, "center" | "flex-start" | "flex-end"> = {
              center: "center",
              left: "flex-start",
              right: "flex-end",
            };
            const textAlign = (el.align ?? "center") as "center" | "left" | "right";

            return (
              <div
                key={el.id}
                style={{
                  position: "absolute",
                  top: `${topPct}%`,
                  left: 0,
                  right: 0,
                  transform: "translateY(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: alignMap[textAlign] ?? "center",
                  padding: "0 64px",
                }}
              >
                {el.text.split("\n").map((line: string, li: number) => (
                  <span
                    key={li}
                    style={{
                      fontSize: el.fontSize ?? 16,
                      fontWeight: fontWeightNum(el.fontWeight ?? "normal"),
                      color: el.color ?? "#ffffff",
                      textAlign,
                      lineHeight: 1.3,
                      wordBreak: "break-word",
                      maxWidth: "100%",
                      display: "block",
                    }}
                  >
                    {line || " "}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      ),
      {
        width: W,
        height,
      }
    );

    // Add filename header
    const headers = new Headers(imageResponse.headers);
    headers.set("Content-Disposition", `attachment; filename="slide-${slideIndex + 1}.png"`);
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(imageResponse.body, { status: 200, headers });
  } catch (err) {
    console.error("Slide PNG error:", err);
    return new Response("Render error", { status: 500 });
  }
}
