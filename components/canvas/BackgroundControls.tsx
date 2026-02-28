"use client";

import { useCanvasStore, type SlideBackground } from "@/store/canvasStore";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  { label: "Dark Black", value: "linear-gradient(135deg, #0a0a0f 0%, #111118 100%)" },
  { label: "Dark Blue", value: "linear-gradient(135deg, #0a0a0f 0%, #0f1a2e 100%)" },
  { label: "Dark Gold", value: "linear-gradient(160deg, #0a0a0f 0%, #1a1500 60%, #0a0a0f 100%)" },
  { label: "Midnight", value: "linear-gradient(135deg, #050508 0%, #0d0d1a 100%)" },
  { label: "Carbon", value: "linear-gradient(135deg, #111114 0%, #1a1a1e 100%)" },
  { label: "Navy Blue", value: "linear-gradient(135deg, #0a0f1a 0%, #0d1a2e 100%)" },
];

const SOLID_COLORS = [
  "#000000", "#0a0a0f", "#111118", "#1a1a24",
  "#ffffff", "#f0f0f5",
];

export function BackgroundControls() {
  const { slides, selectedSlideId, updateSlide } = useCanvasStore();
  const slide = slides.find((s) => s.id === selectedSlideId);

  if (!slide) return null;

  const update = (bg: Partial<SlideBackground>) => {
    updateSlide(slide.id, { background: { ...slide.background, ...bg } });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
        <p className="text-xs font-medium text-white/60">Hintergrund & Format</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Aspect ratio */}
        <div>
          <p className="text-[10px] text-white/30 mb-2">Format</p>
          <div className="flex gap-2">
            {(["1:1", "4:5", "9:16"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => updateSlide(slide.id, { aspectRatio: ratio })}
                className={cn(
                  "flex-1 py-1.5 text-[11px] rounded-lg border transition-all",
                  slide.aspectRatio === ratio
                    ? "border-[#1d4ed8]/40 bg-[#1d4ed8]/10 text-[#60a5fa]"
                    : "border-white/[0.08] text-white/40 hover:border-white/20"
                )}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Background type */}
        <div>
          <p className="text-[10px] text-white/30 mb-2">Typ</p>
          <div className="flex gap-2">
            {(["solid", "gradient"] as const).map((type) => (
              <button
                key={type}
                onClick={() => update({ type })}
                className={cn(
                  "flex-1 py-1.5 text-[11px] rounded-lg border transition-all",
                  slide.background.type === type
                    ? "border-[#1d4ed8]/40 bg-[#1d4ed8]/10 text-[#60a5fa]"
                    : "border-white/[0.08] text-white/40 hover:border-white/20"
                )}
              >
                {type === "solid" ? "Vollfarbe" : "Gradient"}
              </button>
            ))}
          </div>
        </div>

        {/* Gradients */}
        {slide.background.type === "gradient" && (
          <div>
            <p className="text-[10px] text-white/30 mb-2">Gradient</p>
            <div className="grid grid-cols-2 gap-2">
              {GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => update({ gradient: g.value })}
                  className={cn(
                    "h-10 rounded-xl border-2 transition-all",
                    slide.background.gradient === g.value
                      ? "border-[#1d4ed8]"
                      : "border-transparent hover:border-white/20"
                  )}
                  style={{ background: g.value }}
                  title={g.label}
                />
              ))}
            </div>
          </div>
        )}

        {/* Solid colors */}
        {slide.background.type === "solid" && (
          <div>
            <p className="text-[10px] text-white/30 mb-2">Farbe</p>
            <div className="flex flex-wrap gap-2">
              {SOLID_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update({ color: c })}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    slide.background.color === c ? "border-[#1d4ed8] scale-110" : "border-white/10 hover:border-white/30"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <input
              type="color"
              value={slide.background.color ?? "#000000"}
              onChange={(e) => update({ color: e.target.value })}
              className="mt-2 w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
            />
          </div>
        )}
      </div>
    </div>
  );
}
