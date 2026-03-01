"use client";

import { forwardRef } from "react";
import { LockIcon } from "lucide-react";
import { type Slide, type TextElement, useCanvasStore, buildGradientCss } from "@/store/canvasStore";
import { cn } from "@/lib/utils";

const ASPECT_RATIOS: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
};

const FONT_WEIGHTS: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
};

const ALIGN_MAP: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

type Props = {
  slide: Slide;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  scale?: number;
  interactive?: boolean;
};

export const SlidePreview = forwardRef<HTMLDivElement, Props>(
  ({ slide, selectedElementId, onSelectElement, scale = 1, interactive = false }, ref) => {
    const grainIntensity  = useCanvasStore((s) => s.grainIntensity);
    const grainSize       = useCanvasStore((s) => s.grainSize ?? 40);
    const grainDensity    = useCanvasStore((s) => s.grainDensity ?? 50);
    const grainSharpness  = useCanvasStore((s) => s.grainSharpness ?? 50);
    const bg = slide.background;
    let backgroundStyle: React.CSSProperties = {};

    if (bg.type === "solid" && bg.color) {
      backgroundStyle = { backgroundColor: bg.color };
    } else if (bg.type === "gradient") {
      const css = bg.customGradient
        ? buildGradientCss(bg.customGradient)
        : (bg.gradient ?? "linear-gradient(135deg,#050508,#111118)");
      backgroundStyle = { background: css };
    } else if (bg.type === "image" && bg.imageUrl) {
      backgroundStyle = {
        backgroundImage: `url(${bg.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }

    return (
      <div
        ref={ref}
        className={cn("relative overflow-hidden w-full", ASPECT_RATIOS[slide.aspectRatio])}
        style={backgroundStyle}
        onClick={() => interactive && onSelectElement?.(null)}
      >
        {/* Grain overlay via SVG feTurbulence */}
        {grainIntensity > 0 && (() => {
          // grainSize 0=tiny(0.9) → 100=large(0.08)
          const baseFreq = (0.9 - (grainSize / 100) * 0.82).toFixed(3);
          // grainDensity 0=1 octave → 100=6 octaves
          const octaves = Math.round(1 + (grainDensity / 100) * 5);
          // grainSharpness → contrast filter
          const contrast = 1 + (grainSharpness / 100) * 4;
          const opacity = (grainIntensity / 100) * 0.60;
          return (
            <svg
              aria-hidden
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                opacity,
                mixBlendMode: "overlay",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              <defs>
                <filter id={`grain-${slide.id}`} colorInterpolationFilters="sRGB">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency={baseFreq}
                    numOctaves={String(octaves)}
                    stitchTiles="stitch"
                  />
                  <feColorMatrix type="saturate" values="0" />
                  <feComponentTransfer>
                    <feFuncR type="linear" slope={String(contrast)} intercept={String(-(contrast - 1) / 2)} />
                    <feFuncG type="linear" slope={String(contrast)} intercept={String(-(contrast - 1) / 2)} />
                    <feFuncB type="linear" slope={String(contrast)} intercept={String(-(contrast - 1) / 2)} />
                  </feComponentTransfer>
                </filter>
              </defs>
              <rect width="100%" height="100%" filter={`url(#grain-${slide.id})`} />
            </svg>
          );
        })()}

        {slide.elements.map((el) => (
          <ElementRenderer
            key={el.id}
            element={el}
            selected={selectedElementId === el.id}
            onSelect={interactive ? () => onSelectElement?.(el.id) : undefined}
            scale={scale}
          />
        ))}
      </div>
    );
  }
);

SlidePreview.displayName = "SlidePreview";

function ElementRenderer({
  element,
  selected,
  onSelect,
  scale,
}: {
  element: TextElement;
  selected: boolean;
  onSelect?: () => void;
  scale: number;
}) {
  const anchorTransform: Record<string, string> = {
    top:    "translateY(0%)",
    center: "translateY(-50%)",
    bottom: "translateY(-100%)",
  };
  const transform = anchorTransform[element.verticalAnchor ?? "center"];

  const paddingXpct = element.paddingX ?? 6;

  return (
    <div
      className={cn(
        "absolute w-full transition-all",
        onSelect && "cursor-pointer",
        selected && "outline outline-1 outline-[#1d4ed8]/60 outline-offset-1 rounded"
      )}
      style={{
        top: `${element.y}%`,
        left: 0,
        paddingLeft: `${paddingXpct}%`,
        paddingRight: `${paddingXpct}%`,
        transform,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <p
        className={cn(
          FONT_WEIGHTS[element.fontWeight],
          ALIGN_MAP[element.align]
        )}
        style={{
          fontSize: `${element.fontSize * scale}px`,
          color: element.color,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          fontFamily: element.fontFamily ?? "Inter, sans-serif",
          lineHeight: element.lineHeight ?? 1.3,
          letterSpacing: element.letterSpacing != null ? `${element.letterSpacing}em` : undefined,
        }}
      >
        {element.text
          .split("\u005C\u006E").join("\u000A")
          .split("\u002F\u006E").join("\u000A")
          .split("\u000D\u000A").join("\u000A")
          .split("\u000D").join("\u000A")}
      </p>

      {/* Lock indicator – only visible in interactive (editor) mode */}
      {onSelect && element.locked && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-1 opacity-50 pointer-events-none"
          style={{ fontSize: `${8 * scale}px` }}
        >
          <LockIcon size={Math.max(8, 10 * scale)} className="text-[#60a5fa]" />
        </div>
      )}
    </div>
  );
}
