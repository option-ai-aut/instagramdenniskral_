/**
 * Shared server-side slide renderer (Satori / next/og).
 * Works on both Edge and Node runtimes.
 */
import { ImageResponse } from "next/og";
import type { Slide, TextElement } from "@/store/canvasStore";
import { collectSatoriFonts } from "./satori-fonts";

export const SLIDE_WIDTH = 1080;

export function getSlideHeight(aspectRatio: string): number {
  if (aspectRatio === "1:1") return SLIDE_WIDTH;
  if (aspectRatio === "9:16") return Math.round(SLIDE_WIDTH * (16 / 9));
  return Math.round(SLIDE_WIDTH * (5 / 4)); // default 4:5
}

function fontWeightNum(fw: string | undefined): number {
  const map: Record<string, number> = {
    normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800,
  };
  return map[fw ?? "normal"] ?? 400;
}

function buildBgStyle(slide: Slide): React.CSSProperties {
  const bg = slide.background;
  if (bg.type === "solid" && bg.color) return { backgroundColor: bg.color };
  if (bg.type === "gradient" && bg.gradient) return { backgroundImage: bg.gradient };
  if (bg.type === "image" && bg.imageUrl) return { backgroundImage: `url(${bg.imageUrl})`, backgroundSize: "cover" };
  return { backgroundColor: "#0a0a0f" };
}

const ANCHOR_TRANSFORM: Record<string, string> = {
  top:    "translateY(0%)",
  center: "translateY(-50%)",
  bottom: "translateY(-100%)",
};

/** Render a slide to a PNG ArrayBuffer via Satori. */
export async function renderSlideToPng(slide: Slide): Promise<ArrayBuffer> {
  const W = SLIDE_WIDTH;
  const H = getSlideHeight(slide.aspectRatio ?? "4:5");
  const bgStyle = buildBgStyle(slide);
  const elements = (slide.elements ?? []) as TextElement[];
  const fonts = await collectSatoriFonts(elements);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          ...bgStyle,
        }}
      >
        {elements.map((el) => {
          const alignMap: Record<string, "center" | "flex-start" | "flex-end"> = {
            center: "center",
            left: "flex-start",
            right: "flex-end",
          };
          const textAlign = (el.align ?? "center") as "center" | "left" | "right";
          const transform = ANCHOR_TRANSFORM[(el as TextElement & { verticalAnchor?: string }).verticalAnchor ?? "center"];

          return (
            <div
              key={el.id}
              style={{
                position: "absolute",
                top: `${el.y ?? 50}%`,
                left: 0,
                right: 0,
                transform,
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
                    fontWeight: fontWeightNum(el.fontWeight),
                    fontFamily: el.fontFamily ?? "Inter",
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
    { width: W, height: H, fonts }
  );

  return response.arrayBuffer();
}
