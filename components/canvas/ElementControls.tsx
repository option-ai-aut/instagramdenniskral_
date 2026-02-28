"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2Icon, PlusIcon } from "lucide-react";
import { useCanvasStore, type TextElement } from "@/store/canvasStore";
import { cn } from "@/lib/utils";

const COLORS = [
  "#ffffff", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.3)",
  "#7c6af7", "#a78bfa", "#34d399", "#fbbf24", "#f87171",
  "#000000",
];

const FONT_WEIGHTS: Array<{ value: TextElement["fontWeight"]; label: string }> = [
  { value: "normal", label: "Regular" },
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
  { value: "extrabold", label: "Extra Bold" },
];

/**
 * Smooth range slider that keeps local state while dragging
 * and only commits to the store on pointer-up.
 */
function RangeSlider({
  min,
  max,
  value,
  onCommit,
}: {
  min: number;
  max: number;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);

  // Sync when the element selection changes (external value change)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(Number(e.target.value));
  }, []);

  const handleCommit = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    onCommit(Number((e.target as HTMLInputElement).value));
  }, [onCommit]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={local}
      onChange={handleChange}
      onPointerUp={handleCommit}
      className="w-full accent-[#7c6af7]"
    />
  );
}

export function ElementControls() {
  const {
    slides, selectedSlideId, selectedElementId,
    updateElement, removeElement, addElement, selectElement,
  } = useCanvasStore();

  const slide = slides.find((s) => s.id === selectedSlideId);
  const element = slide?.elements.find((el) => el.id === selectedElementId);

  // Local text state prevents focus-loss on each keystroke
  const [localText, setLocalText] = useState(element?.text ?? "");
  useEffect(() => {
    setLocalText(element?.text ?? "");
  }, [element?.id]); // only sync when element SELECTION changes, not on every text update

  const update = useCallback((patch: Partial<TextElement>) => {
    if (!selectedSlideId || !selectedElementId) return;
    updateElement(selectedSlideId, selectedElementId, patch);
  }, [selectedSlideId, selectedElementId, updateElement]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <p className="text-xs font-medium text-white/60">Elemente</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Add element buttons */}
        <div>
          <p className="text-[10px] text-white/30 mb-2">Hinzufügen</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["header", "subtitle", "body", "tag"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  if (!selectedSlideId) return;
                  addElement(selectedSlideId, type);
                }}
                className="flex items-center justify-center gap-1 py-1.5 text-[11px] rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-all"
              >
                <PlusIcon size={10} />
                {type === "header" ? "Header" : type === "subtitle" ? "Subtitle" : type === "body" ? "Body" : "Tag"}
              </button>
            ))}
          </div>
        </div>

        {element && (
          <>
            <div className="h-px" style={{ background: "var(--glass-border)" }} />

            {/* Text */}
            <div>
              <p className="text-[10px] text-white/30 mb-2">Text</p>
              <textarea
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  update({ text: e.target.value });
                }}
                rows={3}
                className="w-full rounded-xl border text-xs text-white/80 placeholder-white/20 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#7c6af7]/50"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              />
            </div>

            {/* Font size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-white/30">Schriftgröße</p>
                <span className="text-[10px] text-white/50">{element.fontSize}px</span>
              </div>
              <RangeSlider
                min={8}
                max={72}
                value={element.fontSize}
                onCommit={(v) => update({ fontSize: v })}
              />
            </div>

            {/* Font weight */}
            <div>
              <p className="text-[10px] text-white/30 mb-2">Stärke</p>
              <div className="flex flex-wrap gap-1">
                {FONT_WEIGHTS.map((fw) => (
                  <button
                    key={fw.value}
                    onClick={() => update({ fontWeight: fw.value })}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded-lg border transition-all",
                      element.fontWeight === fw.value
                        ? "border-[#7c6af7]/40 bg-[#7c6af7]/10 text-[#a78bfa]"
                        : "border-white/[0.08] text-white/40 hover:border-white/20"
                    )}
                  >
                    {fw.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alignment */}
            <div>
              <p className="text-[10px] text-white/30 mb-2">Ausrichtung</p>
              <div className="flex gap-1.5">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => update({ align })}
                    className={cn(
                      "flex-1 py-1.5 text-[11px] rounded-lg border transition-all",
                      element.align === align
                        ? "border-[#7c6af7]/40 bg-[#7c6af7]/10 text-[#a78bfa]"
                        : "border-white/[0.08] text-white/40 hover:border-white/20"
                    )}
                  >
                    {align === "left" ? "Links" : align === "center" ? "Mitte" : "Rechts"}
                  </button>
                ))}
              </div>
            </div>

            {/* Position Y */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-white/30">Position (vertikal)</p>
                <span className="text-[10px] text-white/50">{element.y}%</span>
              </div>
              <RangeSlider
                min={5}
                max={95}
                value={element.y}
                onCommit={(v) => update({ y: v })}
              />
            </div>

            {/* Color */}
            <div>
              <p className="text-[10px] text-white/30 mb-2">Farbe</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ color: c })}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      element.color === c ? "border-[#7c6af7] scale-110" : "border-transparent hover:border-white/20"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Delete element */}
            <button
              onClick={() => {
                if (!selectedSlideId || !selectedElementId) return;
                removeElement(selectedSlideId, selectedElementId);
                selectElement(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all"
            >
              <Trash2Icon size={12} />
              Element löschen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
