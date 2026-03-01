"use client";

import { forwardRef } from "react";
import { LockIcon } from "lucide-react";
import { type Slide, type TextElement, useCanvasStore } from "@/store/canvasStore";
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
    const grainIntensity = useCanvasStore((s) => s.grainIntensity);
    const bg = slide.background;
    let backgroundStyle: React.CSSProperties = {};

    if (bg.type === "solid" && bg.color) {
      backgroundStyle = { backgroundColor: bg.color };
    } else if (bg.type === "gradient" && bg.gradient) {
      backgroundStyle = { background: bg.gradient };
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
        {/* Grain overlay via SVG feTurbulence – no external file needed */}
        {grainIntensity > 0 && (
          <svg
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: (grainIntensity / 100) * 0.55,
              mixBlendMode: "overlay",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <filter id={`grain-${slide.id}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect
              width="100%"
              height="100%"
              filter={`url(#grain-${slide.id})`}
            />
          </svg>
        )}

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

  return (
    <div
      className={cn(
        "absolute w-full px-6 transition-all",
        onSelect && "cursor-pointer",
        selected && "outline outline-1 outline-[#1d4ed8]/60 outline-offset-1 rounded"
      )}
      style={{
        top: `${element.y}%`,
        left: 0,
        transform,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <p
        className={cn(
          "leading-tight",
          FONT_WEIGHTS[element.fontWeight],
          ALIGN_MAP[element.align]
        )}
        style={{
          fontSize: `${element.fontSize * scale}px`,
          color: element.color,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          fontFamily: element.fontFamily ?? "Inter, sans-serif",
        }}
      >
        {element.text}
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
