"use client";

import { useState, useEffect, useCallback } from "react";
import { useCanvasStore, type SlideBackground } from "@/store/canvasStore";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  // Schwarz / Neutral
  { label: "Obsidian",    value: "linear-gradient(135deg, #050508 0%, #111118 100%)" },
  { label: "Carbon",      value: "linear-gradient(160deg, #0e0e11 0%, #1a1a1e 100%)" },
  { label: "Ash",         value: "linear-gradient(135deg, #0a0a0f 0%, #1c1c22 50%, #0a0a0f 100%)" },
  { label: "Graphite",    value: "linear-gradient(180deg, #111114 0%, #1e1e24 100%)" },

  // Blau / Navy
  { label: "Deep Navy",   value: "linear-gradient(135deg, #020408 0%, #0a1628 100%)" },
  { label: "Abyss",       value: "linear-gradient(160deg, #050810 0%, #0d1a30 60%, #050810 100%)" },
  { label: "Steel",       value: "linear-gradient(135deg, #080c14 0%, #111c2e 100%)" },
  { label: "Ink",         value: "linear-gradient(150deg, #06080e 0%, #0e1420 100%)" },

  // Warm / Gold
  { label: "Bronze",      value: "linear-gradient(135deg, #0a0a06 0%, #1a1408 100%)" },
  { label: "Ember",       value: "linear-gradient(160deg, #0d0805 0%, #1e1106 60%, #0d0805 100%)" },
  { label: "Dark Gold",   value: "linear-gradient(135deg, #0a0a0f 0%, #1a1400 50%, #0f0c00 100%)" },

  // Grün / Teal (sehr dunkel, kaum sichtbar)
  { label: "Forest",      value: "linear-gradient(135deg, #060a06 0%, #0d1a0e 100%)" },
  { label: "Slate Teal",  value: "linear-gradient(150deg, #050c0c 0%, #0c1a1a 100%)" },

  // Rauch / Roségold
  { label: "Smoke",       value: "linear-gradient(135deg, #0f0c0c 0%, #1e1818 100%)" },
  { label: "Rosewood",    value: "linear-gradient(135deg, #0d0809 0%, #1a0e10 100%)" },
  { label: "Onyx",        value: "linear-gradient(180deg, #080808 0%, #141416 50%, #080808 100%)" },
];

const SOLID_COLORS = [
  "#000000", "#0a0a0f", "#111118", "#1a1a24",
  "#ffffff", "#f0f0f5",
];

function GrainSlider() {
  const grainIntensity = useCanvasStore((s) => s.grainIntensity);
  const setGrainIntensity = useCanvasStore((s) => s.setGrainIntensity);
  const [local, setLocal] = useState(grainIntensity);

  useEffect(() => { setLocal(grainIntensity); }, [grainIntensity]);

  const handleCommit = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    setGrainIntensity(Number((e.target as HTMLInputElement).value));
  }, [setGrainIntensity]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-white/30">Grain (alle Slides)</p>
        <span className="text-[10px] text-white/50">{local}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={handleCommit}
        className="w-full accent-[#1d4ed8]"
      />
      <p className="text-[9px] text-white/20 mt-1">0 = kein Grain · 100 = maximal</p>
    </div>
  );
}

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
                    "rounded-xl border-2 transition-all overflow-hidden flex flex-col",
                    slide.background.gradient === g.value
                      ? "border-[#1d4ed8]"
                      : "border-white/[0.06] hover:border-white/20"
                  )}
                  title={g.label}
                >
                  <div className="h-10 w-full" style={{ background: g.value }} />
                  <div
                    className="px-2 py-1 text-[9px] text-white/40 text-left truncate"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    {g.label}
                  </div>
                </button>
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

        {/* Global grain */}
        <div className="pt-2 border-t" style={{ borderColor: "var(--glass-border)" }}>
          <GrainSlider />
        </div>
      </div>
    </div>
  );
}
