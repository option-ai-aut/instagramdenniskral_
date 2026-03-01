/**
 * Shared server-side slide renderer (Satori / next/og).
 * Node runtime only (uses fs for fallback font).
 */
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import type { Slide, TextElement } from "@/store/canvasStore";
import { collectSatoriFonts, type SatoriFontEntry } from "./satori-fonts";

/** Load the bundled Inter TTF from /public/fonts as a guaranteed fallback. */
function getLocalInterFont(): SatoriFontEntry | null {
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
    const buf = fs.readFileSync(fontPath);
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { name: "Inter", data, weight: 400, style: "normal" };
  } catch {
    return null;
  }
}

export const SLIDE_WIDTH = 1080;

/**
 * The canvas editor renders the preview at max-w-[380px] with scale=1.
 * All font sizes and measurements in the store are authored at this width.
 * We multiply by this factor to maintain visual proportionality at 1080px.
 */
const DESIGN_WIDTH = 380;
const DESIGN_SCALE = SLIDE_WIDTH / DESIGN_WIDTH; // ≈ 2.842

/** Editor uses px-6 (24px) padding. Scale to Satori canvas. */
const SATORI_PADDING = Math.round(24 * DESIGN_SCALE); // ≈ 68px

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

/** Generate a grayscale noise PNG as a base64 data URL (no external file needed). */
let _cachedGrainDataUrl: string | null = null;
function getGrainDataUrl(): string {
  if (_cachedGrainDataUrl) return _cachedGrainDataUrl;

  const { deflateSync } = require("zlib") as typeof import("zlib");
  const { randomBytes } = require("crypto") as typeof import("crypto");

  const W = 256, H = 256;

  // Build CRC32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c;
  }
  function crc32(buf: Buffer): Buffer {
    let crc = 0xFFFFFFFF;
    for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    const out = Buffer.alloc(4);
    out.writeUInt32BE((~crc) >>> 0);
    return out;
  }
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, "ascii");
    return Buffer.concat([len, typeB, data, crc32(Buffer.concat([typeB, data]))]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit-depth
  ihdr[9] = 0; // color-type: grayscale

  const noise = randomBytes(H * W);
  const raw = Buffer.alloc(H * (W + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0; // filter: None
    noise.copy(raw, y * (W + 1) + 1, y * W, (y + 1) * W);
  }

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  _cachedGrainDataUrl = `data:image/png;base64,${png.toString("base64")}`;
  return _cachedGrainDataUrl;
}

/** Render a slide to a PNG ArrayBuffer via Satori. */
export async function renderSlideToPng(
  slide: Slide,
  grainIntensity = 0,
): Promise<ArrayBuffer> {
  const W = SLIDE_WIDTH;
  const H = getSlideHeight(slide.aspectRatio ?? "4:5");
  const bgStyle = buildBgStyle(slide);
  const elements = (slide.elements ?? []) as TextElement[];

  // Load Google Fonts (best-effort); guarantee at least Inter from local disk
  let fonts: SatoriFontEntry[] = [];
  try {
    fonts = await collectSatoriFonts(elements);
  } catch {
    // Font fetch failed – will use local fallback below
  }

  // Always ensure at least one font is available
  if (fonts.length === 0) {
    const fallback = getLocalInterFont();
    if (fallback) fonts = [fallback];
  } else {
    // Ensure Inter is present as fallback even when custom fonts loaded
    const hasInter = fonts.some((f) => f.name === "Inter");
    if (!hasInter) {
      const fallback = getLocalInterFont();
      if (fallback) fonts = [...fonts, fallback];
    }
  }

  if (fonts.length === 0) {
    throw new Error("No fonts available for rendering");
  }

  const grainDataUrl = grainIntensity > 0 ? getGrainDataUrl() : null;
  const grainOpacity = (grainIntensity / 100) * 0.45;
  const grainTileSize = 256; // matches the grain.png dimensions

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
        {/* Grain overlay via tiled img elements */}
        {grainDataUrl && grainOpacity > 0 && (() => {
          const cols = Math.ceil(W / grainTileSize);
          const rows = Math.ceil(H / grainTileSize);
          const tiles: React.ReactElement[] = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              tiles.push(
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`g-${r}-${c}`}
                  src={grainDataUrl}
                  width={grainTileSize}
                  height={grainTileSize}
                  style={{
                    position: "absolute",
                    top: r * grainTileSize,
                    left: c * grainTileSize,
                    width: grainTileSize,
                    height: grainTileSize,
                    opacity: grainOpacity,
                    mixBlendMode: "overlay",
                  }}
                  alt=""
                />
              );
            }
          }
          return tiles;
        })()}

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
                  padding: `0 ${SATORI_PADDING}px`,
              }}
            >
              {el.text.split("\n").map((line: string, li: number) => (
                <span
                  key={li}
                  style={{
                    // Scale font size from design-width (380px) to Satori canvas (1080px)
                    fontSize: Math.round((el.fontSize ?? 16) * DESIGN_SCALE),
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
