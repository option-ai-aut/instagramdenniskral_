"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { DownloadIcon, SaveIcon, LayoutTemplateIcon, LoaderIcon, CheckIcon, SlidersIcon, PaletteIcon } from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import { SlideList } from "@/components/canvas/SlideList";
import { SlidePreview } from "@/components/canvas/SlidePreview";
import { ElementControls } from "@/components/canvas/ElementControls";
import { BackgroundControls } from "@/components/canvas/BackgroundControls";
import { cn } from "@/lib/utils";

type Tab = "elements" | "background" | "templates";
type MobileView = "preview" | "slides" | "controls";

export default function CanvasPage() {
  const {
    slides, selectedSlideId, selectedElementId, carouselTitle,
    selectElement, setTitle, setSavedId, templates, loadTemplate,
  } = useCanvasStore();

  const selectedSlide = slides.find((s) => s.id === selectedSlideId);
  const slideRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("elements");
  const [mobileView, setMobileView] = useState<MobileView>("preview");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: carouselTitle, slidesJson: slides }),
      });
      const { carousel } = await res.json();
      if (carousel?.id) setSavedId(carousel.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!slideRef.current) return;
    setExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        useCanvasStore.getState().selectSlide(slides[i].id);
        await new Promise((r) => setTimeout(r, 100));
        if (!slideRef.current) break;
        const dataUrl = await toPng(slideRef.current, { pixelRatio: 2 });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `slide-${i + 1}.png`;
        a.click();
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setExporting(false);
    }
  };

  const ControlsPanel = () => (
    <>
      <div className="flex border-b flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
        {(["elements", "background", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2.5 text-[11px] font-medium transition-colors",
              tab === t ? "text-white border-b-2 border-[#7c6af7]" : "text-white/30 hover:text-white/60"
            )}
          >
            {t === "elements" ? "Text" : t === "background" ? "Design" : "Vorlagen"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "elements" && <ElementControls />}
        {tab === "background" && <BackgroundControls />}
        {tab === "templates" && (
          <div className="p-4 space-y-2">
            <p className="text-[10px] text-white/30 mb-3">Vorlage laden ersetzt alle Slides</p>
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => loadTemplate(tpl.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.08] text-xs text-white/50 hover:text-white hover:border-white/20 transition-all text-left"
              >
                <LayoutTemplateIcon size={13} className="flex-shrink-0 text-[#7c6af7]" />
                {tpl.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* ── Toolbar (shared) ── */}
      <div
        className="px-4 py-2.5 border-b glass flex items-center gap-2 flex-shrink-0 relative z-10"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <input
          value={carouselTitle}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-sm font-medium text-white/80 placeholder-white/20 focus:outline-none min-w-0"
          placeholder="Titel..."
        />
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white transition-all disabled:opacity-40"
        >
          {exporting ? <LoaderIcon size={12} className="animate-spin" /> : <DownloadIcon size={12} />}
          <span className="hidden sm:inline">Export</span>
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
            saved
              ? "border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399]"
              : "border-[#7c6af7]/30 text-[#a78bfa] hover:bg-[#7c6af7]/10"
          )}
        >
          {saving ? <LoaderIcon size={12} className="animate-spin" /> : saved ? <CheckIcon size={12} /> : <SaveIcon size={12} />}
          <span className="hidden sm:inline">{saved ? "Gespeichert" : "Speichern"}</span>
        </button>
      </div>

      {/* ── DESKTOP: 3-column layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden relative z-10">
        <div className="w-[160px] flex-shrink-0 flex flex-col border-r glass" style={{ borderColor: "var(--glass-border)" }}>
          <SlideList />
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {selectedSlide ? (
            <div className="w-full max-w-[380px] rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: "0 0 60px rgba(124,106,247,0.15), 0 0 0 1px rgba(255,255,255,0.05)" }}>
              <SlidePreview ref={slideRef} slide={selectedSlide} selectedElementId={selectedElementId} onSelectElement={selectElement} scale={1} interactive />
            </div>
          ) : (
            <p className="text-white/20 text-sm">Kein Slide ausgewählt</p>
          )}
        </div>
        <div className="w-[240px] flex-shrink-0 flex flex-col border-l glass" style={{ borderColor: "var(--glass-border)" }}>
          <ControlsPanel />
        </div>
      </div>

      {/* ── MOBILE: tab layout ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative z-10">
        {/* Mobile tab bar */}
        <div className="flex-shrink-0 flex border-b" style={{ background: "rgba(17,17,24,0.95)", borderColor: "var(--glass-border)" }}>
          {([
            { id: "preview" as const, label: "Vorschau", icon: null },
            { id: "slides" as const, label: `Slides (${slides.length})`, icon: null },
            { id: "controls" as const, label: "Bearbeiten", icon: null },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setMobileView(v.id)}
              className={cn(
                "flex-1 py-2.5 text-[11px] font-medium transition-colors border-b-2",
                mobileView === v.id ? "text-[#a78bfa] border-[#7c6af7]" : "text-white/30 border-transparent"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden">
          {mobileView === "preview" && (
            <div className="h-full overflow-auto flex items-center justify-center p-6">
              {selectedSlide ? (
                <div className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: "0 0 40px rgba(124,106,247,0.2), 0 0 0 1px rgba(255,255,255,0.05)" }}>
                  <SlidePreview
                    ref={slideRef}
                    slide={selectedSlide}
                    selectedElementId={selectedElementId}
                    onSelectElement={selectElement}
                    scale={1}
                    interactive
                  />
                </div>
              ) : (
                <p className="text-white/20 text-sm">Kein Slide ausgewählt</p>
              )}
            </div>
          )}
          {mobileView === "slides" && <SlideList />}
          {mobileView === "controls" && (
            <div className="flex flex-col h-full">
              <ControlsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
