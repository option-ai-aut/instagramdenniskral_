"use client";

import { forwardRef } from "react";
import { type Slide, type TextElement } from "@/store/canvasStore";
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
        transform: "translateY(-50%)",
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
    </div>
  );
}
