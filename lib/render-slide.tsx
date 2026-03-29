/**
 * Shared server-side slide renderer (Satori / next/og).
 * Node runtime only (uses fs for fallback font).
 */
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import type { Slide, TextElement } from "@/store/canvasStore";
import { buildGradientCss } from "@/store/canvasStore";
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

/** Default export width – 2K. Can be overridden per-render. */
export const DEFAULT_SLIDE_WIDTH = 2160;

/** Supported resolution presets */
export type ResolutionPreset = "2K" | "4K";
export const RESOLUTION_WIDTHS: Record<ResolutionPreset, number> = {
  "2K": 2160,
  "4K": 4320,
};

const DESIGN_WIDTH = 380;

function getDesignScale(slideWidth: number) { return slideWidth / DESIGN_WIDTH; }
function getSatoriPadding(slideWidth: number) { return Math.round(24 * getDesignScale(slideWidth)); }

export function getSlideHeight(aspectRatio: string, slideWidth = DEFAULT_SLIDE_WIDTH): number {
  if (aspectRatio === "1:1") return slideWidth;
  if (aspectRatio === "9:16") return Math.round(slideWidth * (16 / 9));
  return Math.round(slideWidth * (5 / 4)); // default 4:5
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
  if (bg.type === "gradient") {
    const css = bg.customGradient
      ? buildGradientCss(bg.customGradient)
      : (bg.gradient ?? "linear-gradient(135deg,#050508,#111118)");
    return { backgroundImage: css };
  }
  if (bg.type === "image" && bg.imageUrl) return { backgroundImage: `url(${bg.imageUrl})`, backgroundSize: "cover" };
  return { backgroundColor: "#0a0a0f" };
}

const ANCHOR_TRANSFORM: Record<string, string> = {
  top:    "translateY(0%)",
  center: "translateY(-50%)",
  bottom: "translateY(-100%)",
};

/** Generate a grayscale noise PNG varying by grain parameters. */
const _grainCache = new Map<string, string>();
function getGrainDataUrl(grainSize = 40, grainDensity = 50, grainSharpness = 50): string {
  const key = `${grainSize}:${grainDensity}:${grainSharpness}`;
  if (_grainCache.has(key)) return _grainCache.get(key)!;

  const { deflateSync } = require("zlib") as typeof import("zlib");
  const { randomBytes } = require("crypto") as typeof import("crypto");

  // Larger size value = larger noise blocks (tile 32px→256px)
  const tileSize = Math.round(32 + (grainSize / 100) * 224);
  const W = Math.max(64, tileSize), H = Math.max(64, tileSize);

  // Contrast multiplier driven by sharpness (1 = no change, 5 = very sharp)
  const contrast = 1 + (grainSharpness / 100) * 4;

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
  ihdr[8] = 8; ihdr[9] = 0; // grayscale

  // Density: blend multiple noise passes (0=1 pass, 100=4 passes averaged)
  const passes = 1 + Math.round((grainDensity / 100) * 3);
  const noiseData = Buffer.alloc(H * W, 128);
  for (let p = 0; p < passes; p++) {
    const pass = randomBytes(H * W);
    for (let i = 0; i < H * W; i++) {
      noiseData[i] = Math.round((noiseData[i] * p + pass[i]) / (p + 1));
    }
  }

  // Apply contrast
  const raw = Buffer.alloc(H * (W + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const v = noiseData[y * W + x] / 255;
      const c = Math.max(0, Math.min(1, contrast * (v - 0.5) + 0.5));
      raw[y * (W + 1) + 1 + x] = Math.round(c * 255);
    }
  }

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  _grainCache.set(key, dataUrl);
  return dataUrl;
}

/** Render a slide to a PNG ArrayBuffer via Satori. */
export async function renderSlideToPng(
  slide: Slide,
  grainIntensity = 0,
  grainSize = 40,
  grainDensity = 50,
  grainSharpness = 50,
  slideWidth = DEFAULT_SLIDE_WIDTH,
): Promise<ArrayBuffer> {
  const W = slideWidth;
  const H = getSlideHeight(slide.aspectRatio ?? "4:5", slideWidth);
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

  const grainDataUrl = grainIntensity > 0 ? getGrainDataUrl(grainSize, grainDensity, grainSharpness) : null;
  const grainOpacity = (grainIntensity / 100) * 0.55;
  const grainTileSize = 256;

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

          // Resolve per-element spacing values (with defaults)
          const elTyped = el as TextElement & { lineHeight?: number; letterSpacing?: number; paddingX?: number };
          const elLineHeight = elTyped.lineHeight ?? 1.3;
          const designScale = getDesignScale(W);
          // letterSpacing stored in em – convert to px at Satori font size
          const elFontSize = Math.round((el.fontSize ?? 16) * designScale);
          const elLetterSpacing = elTyped.letterSpacing != null
            ? elTyped.letterSpacing * elFontSize
            : 0;
          // paddingX stored as % of design width – convert to Satori px
          const elPaddingPx = elTyped.paddingX != null
            ? Math.round((elTyped.paddingX / 100) * W)
            : getSatoriPadding(W);

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
                paddingLeft: elPaddingPx,
                paddingRight: elPaddingPx,
              }}
            >
              {String(el.text ?? "")
                .split("\u005C\u006E").join("\u000A")
                .split("\u002F\u006E").join("\u000A")
                .split("\u000D\u000A").join("\u000A")
                .split("\u000D").join("\u000A")
                .split("\u000A").map((line: string, li: number) => (
                <span
                  key={li}
                  style={{
                    fontSize: elFontSize,
                    fontWeight: fontWeightNum(el.fontWeight),
                    fontFamily: el.fontFamily ?? "Inter",
                    color: el.color ?? "#ffffff",
                    textAlign,
                    lineHeight: elLineHeight,
                    // Never pass undefined to Satori – it crashes calling .trim() on it
                    ...(elLetterSpacing !== 0 ? { letterSpacing: elLetterSpacing } : {}),
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
