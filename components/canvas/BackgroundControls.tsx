"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCanvasStore, buildGradientCss, type SlideBackground, type CustomGradient, type GradientStop } from "@/store/canvasStore";
import { cn } from "@/lib/utils";

/* ─── preset swatches ─────────────────────────────────────── */
const GRADIENTS = [
  { label: "Obsidian",   value: "linear-gradient(135deg, #050508 0%, #111118 100%)" },
  { label: "Carbon",     value: "linear-gradient(160deg, #0e0e11 0%, #1a1a1e 100%)" },
  { label: "Ash",        value: "linear-gradient(135deg, #0a0a0f 0%, #1c1c22 50%, #0a0a0f 100%)" },
  { label: "Graphite",   value: "linear-gradient(180deg, #111114 0%, #1e1e24 100%)" },
  { label: "Deep Navy",  value: "linear-gradient(135deg, #020408 0%, #0a1628 100%)" },
  { label: "Abyss",      value: "linear-gradient(160deg, #050810 0%, #0d1a30 60%, #050810 100%)" },
  { label: "Steel",      value: "linear-gradient(135deg, #080c14 0%, #111c2e 100%)" },
  { label: "Ink",        value: "linear-gradient(150deg, #06080e 0%, #0e1420 100%)" },
  { label: "Bronze",     value: "linear-gradient(135deg, #0a0a06 0%, #1a1408 100%)" },
  { label: "Ember",      value: "linear-gradient(160deg, #0d0805 0%, #1e1106 60%, #0d0805 100%)" },
  { label: "Dark Gold",  value: "linear-gradient(135deg, #0a0a0f 0%, #1a1400 50%, #0f0c00 100%)" },
  { label: "Forest",     value: "linear-gradient(135deg, #060a06 0%, #0d1a0e 100%)" },
  { label: "Slate Teal", value: "linear-gradient(150deg, #050c0c 0%, #0c1a1a 100%)" },
  { label: "Smoke",      value: "linear-gradient(135deg, #0f0c0c 0%, #1e1818 100%)" },
  { label: "Rosewood",   value: "linear-gradient(135deg, #0d0809 0%, #1a0e10 100%)" },
  { label: "Onyx",       value: "linear-gradient(180deg, #080808 0%, #141416 50%, #080808 100%)" },
];

const SOLID_COLORS = ["#000000", "#0a0a0f", "#111118", "#1a1a24", "#ffffff", "#f0f0f5"];

/* ─── helpers ─────────────────────────────────────────────── */
function RangeSlider({
  label, min, max, value, unit = "", onChange,
}: { label: string; min: number; max: number; value: number; unit?: string; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-white/30">{label}</p>
        <span className="text-[10px] text-white/50 tabular-nums">{local}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        className="w-full accent-[#1d4ed8]"
      />
    </div>
  );
}

/* ─── GrainControls ───────────────────────────────────────── */
function GrainControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] text-white/40 w-[68px] flex-shrink-0">{label}</p>
      <input
        type="range" min={0} max={100} value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        className="flex-1 accent-[#1d4ed8]"
      />
      <span className="text-[10px] text-white/40 w-7 text-right tabular-nums flex-shrink-0">{local}%</span>
    </div>
  );
}

function GrainSlider() {
  const { grainIntensity, grainSize, grainDensity, grainSharpness,
          setGrainIntensity, setGrainSize, setGrainDensity, setGrainSharpness } = useCanvasStore();

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Grain / Textur</p>
      <GrainControl label="Intensität" value={grainIntensity} onChange={setGrainIntensity} />
      <GrainControl label="Größe"      value={grainSize}      onChange={setGrainSize} />
      <GrainControl label="Dichte"     value={grainDensity}   onChange={setGrainDensity} />
      <GrainControl label="Schärfe"    value={grainSharpness} onChange={setGrainSharpness} />
    </div>
  );
}

/* ─── CustomGradientEditor ────────────────────────────────── */
const DEFAULT_CG: CustomGradient = {
  mode: "linear", angle: 135,
  cx: 50, cy: 50,
  stops: [
    { color: "#050810", position: 0 },
    { color: "#0d1a30", position: 100 },
  ],
};

function ColorInput({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      onClick={() => ref.current?.click()}
      className="w-7 h-7 rounded-lg border-2 border-white/10 hover:border-white/30 flex-shrink-0 overflow-hidden transition-all"
      style={{ background: color }}
      title={color}
    >
      <input
        ref={ref}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="opacity-0 w-full h-full cursor-pointer"
      />
    </button>
  );
}

function StopPositionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="range" min={0} max={100} value={local}
      onChange={(e) => setLocal(Number(e.target.value))}
      onPointerUp={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      className="flex-1 accent-[#1d4ed8]"
    />
  );
}

function CustomGradientEditor({
  initial, onApply,
}: { initial?: CustomGradient; onApply: (cg: CustomGradient) => void }) {
  const [cg, setCg] = useState<CustomGradient>(initial ?? DEFAULT_CG);

  // sync when parent changes (e.g. slide switched)
  useEffect(() => { setCg(initial ?? DEFAULT_CG); }, [initial]);

  const preview = buildGradientCss(cg);

  const set = useCallback((patch: Partial<CustomGradient>) => {
    setCg((prev) => {
      const next = { ...prev, ...patch };
      onApply(next);
      return next;
    });
  }, [onApply]);

  const updateStop = useCallback((i: number, patch: Partial<GradientStop>) => {
    setCg((prev) => {
      const stops = prev.stops.map((s, idx) => idx === i ? { ...s, ...patch } : s);
      const next = { ...prev, stops };
      onApply(next);
      return next;
    });
  }, [onApply]);

  const addStop = () => {
    if (cg.stops.length >= 4) return;
    const mid = Math.round((cg.stops[cg.stops.length - 1].position + cg.stops[0].position) / 2);
    const next = { ...cg, stops: [...cg.stops, { color: "#1d4ed8", position: mid }] };
    setCg(next);
    onApply(next);
  };

  const removeStop = (i: number) => {
    if (cg.stops.length <= 2) return;
    const next = { ...cg, stops: cg.stops.filter((_, idx) => idx !== i) };
    setCg(next);
    onApply(next);
  };

  return (
    <div className="space-y-3">
      {/* Preview bar */}
      <div className="h-10 w-full rounded-xl border border-white/[0.06]" style={{ background: preview }} />

      {/* Mode */}
      <div>
        <p className="text-[10px] text-white/30 mb-1.5">Typ</p>
        <div className="flex gap-1.5">
          {(["linear", "radial"] as const).map((m) => (
            <button
              key={m}
              onClick={() => set({ mode: m })}
              className={cn(
                "flex-1 py-1.5 text-[11px] rounded-lg border transition-all",
                cg.mode === m
                  ? "border-[#1d4ed8]/40 bg-[#1d4ed8]/10 text-[#60a5fa]"
                  : "border-white/[0.08] text-white/40 hover:border-white/20"
              )}
            >
              {m === "linear" ? "Linear" : "Radial"}
            </button>
          ))}
        </div>
      </div>

      {/* Angle – linear only */}
      {cg.mode === "linear" && (
        <RangeSlider
          label="Winkel" min={0} max={360} value={cg.angle} unit="°"
          onChange={(v) => set({ angle: v })}
        />
      )}

      {/* Radial center */}
      {cg.mode === "radial" && (
        <>
          <RangeSlider label="Mittelpunkt X" min={0} max={100} value={cg.cx} unit="%" onChange={(v) => set({ cx: v })} />
          <RangeSlider label="Mittelpunkt Y" min={0} max={100} value={cg.cy} unit="%" onChange={(v) => set({ cy: v })} />
        </>
      )}

      {/* Color stops */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/30">Farbstopps</p>
          {cg.stops.length < 4 && (
            <button
              onClick={addStop}
              className="flex items-center gap-0.5 text-[10px] text-[#60a5fa]/60 hover:text-[#60a5fa] transition-colors"
            >
              <PlusIcon size={10} />
              Hinzufügen
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {cg.stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <ColorInput
                color={stop.color}
                onChange={(c) => updateStop(i, { color: c })}
              />
              <StopPositionSlider
                value={stop.position}
                onChange={(v) => updateStop(i, { position: v })}
              />
              <span className="text-[9px] text-white/30 w-7 text-right tabular-nums flex-shrink-0">{stop.position}%</span>
              {cg.stops.length > 2 && (
                <button
                  onClick={() => removeStop(i)}
                  className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2Icon size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── BackgroundControls ──────────────────────────────────── */
type GradientTab = "presets" | "custom";

export function BackgroundControls() {
  const { slides, selectedSlideId, updateSlide } = useCanvasStore();
  const slide = slides.find((s) => s.id === selectedSlideId);
  const [gradientTab, setGradientTab] = useState<GradientTab>("presets");

  if (!slide) return null;

  const update = (bg: Partial<SlideBackground>) =>
    updateSlide(slide.id, { background: { ...slide.background, ...bg } });

  const isCustomActive = !!slide.background.customGradient;

  // Auto-switch tab when the current slide already has a customGradient
  // (happens when loading a saved carousel with custom gradient)
  const effectiveTab: GradientTab =
    slide.background.type === "gradient" && isCustomActive ? "custom" : gradientTab;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
        <p className="text-xs font-medium text-white/60">Hintergrund & Format</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* ── Aspect ratio ── */}
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

        {/* ── Background type ── */}
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

        {/* ── Global grain – nach Typ ── */}
        <div className="rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
          <GrainSlider />
        </div>

        {/* ── Gradient section ── */}
        {slide.background.type === "gradient" && (
          <div className="space-y-3">
            {/* Sub-tabs: Presets | Custom */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              {([
                { id: "presets", label: "Vorlagen" },
                { id: "custom",  label: "Eigener" },
              ] as { id: GradientTab; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setGradientTab(t.id)}
                  className={cn(
                    "flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-all",
                    effectiveTab === t.id
                      ? "bg-[#1d4ed8]/80 text-white"
                      : "text-white/30 hover:text-white/60"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {effectiveTab === "presets" && (
              <div className="grid grid-cols-2 gap-2">
                {GRADIENTS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => update({ gradient: g.value, customGradient: undefined })}
                    className={cn(
                      "rounded-xl border-2 transition-all overflow-hidden flex flex-col",
                      (!slide.background.customGradient && slide.background.gradient === g.value)
                        ? "border-[#1d4ed8]"
                        : "border-white/[0.06] hover:border-white/20"
                    )}
                    title={g.label}
                  >
                    <div className="h-10 w-full" style={{ background: g.value }} />
                    <div className="px-2 py-1 text-[9px] text-white/40 text-left truncate" style={{ background: "rgba(255,255,255,0.03)" }}>
                      {g.label}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {effectiveTab === "custom" && (
              <CustomGradientEditor
                initial={slide.background.customGradient}
                onApply={(cg) => update({ customGradient: cg, gradient: buildGradientCss(cg) })}
              />
            )}
          </div>
        )}

        {/* ── Solid colors ── */}
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
