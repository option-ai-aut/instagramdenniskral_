"use client";

import { PlusIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/canvasStore";
import { SlidePreview } from "./SlidePreview";

export function SlideList() {
  const { slides, selectedSlideId, selectSlide, addSlide, removeSlide, duplicateSlide } = useCanvasStore();

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 border-b flex-shrink-0 flex items-center justify-between"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <p className="text-xs font-medium text-white/60">
          Slides <span className="text-white/30">{slides.length}</span>
        </p>
        <button
          onClick={addSlide}
          className="flex items-center gap-1 text-[11px] text-[#60a5fa] hover:text-white transition-colors"
        >
          <PlusIcon size={12} />
          Neu
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={cn(
              "group relative rounded-xl overflow-hidden cursor-pointer border transition-all duration-200",
              selectedSlideId === slide.id
                ? "border-[#1d4ed8]/50 ring-1 ring-[#1d4ed8]/20"
                : "border-white/[0.06] hover:border-white/[0.12]"
            )}
            onClick={() => selectSlide(slide.id)}
          >
            <div className="w-full scale-preview">
              <SlidePreview slide={slide} scale={0.3} />
            </div>

            {/* Slide number */}
            <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center">
              <span className="text-[8px] text-white/60">{idx + 1}</span>
            </div>

            {/* Actions */}
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateSlide(slide.id);
                }}
                className="w-5 h-5 rounded bg-black/70 border border-white/10 flex items-center justify-center hover:bg-[#1d4ed8]/30"
              >
                <CopyIcon size={9} className="text-white" />
              </button>
              {slides.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSlide(slide.id);
                  }}
                  className="w-5 h-5 rounded bg-black/70 border border-white/10 flex items-center justify-center hover:bg-red-500/50"
                >
                  <Trash2Icon size={9} className="text-white" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
