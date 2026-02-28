"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";
import {
  DownloadIcon, SaveIcon, LayoutTemplateIcon, LoaderIcon, CheckIcon,
  PlusIcon, FolderOpenIcon, Trash2Icon, BookmarkIcon,
} from "lucide-react";
import { useCanvasStore, type Slide } from "@/store/canvasStore";
import { SlideList } from "@/components/canvas/SlideList";
import { SlidePreview } from "@/components/canvas/SlidePreview";
import { ElementControls } from "@/components/canvas/ElementControls";
import { BackgroundControls } from "@/components/canvas/BackgroundControls";
import { cn } from "@/lib/utils";

type Tab = "elements" | "background" | "saved" | "templates";
type MobileView = "preview" | "slides" | "controls";

type SavedCarousel = {
  id: string;
  title: string;
  slidesJson: Slide[];
  updatedAt: string;
  isTemplate?: boolean;
};

export default function CanvasPage() {
  const {
    slides, selectedSlideId, selectedElementId, carouselTitle, savedCarouselId,
    selectElement, setTitle, setSavedId, templates, loadTemplate, loadCarousel, newCarousel,
  } = useCanvasStore();

  const selectedSlide = slides.find((s) => s.id === selectedSlideId);
  const slideRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("elements");
  const [mobileView, setMobileView] = useState<MobileView>("preview");
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
  const [loadingCarousels, setLoadingCarousels] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCarousels = useCallback(async () => {
    setLoadingCarousels(true);
    try {
      const res = await fetch("/api/carousel");
      if (res.ok) {
        const { carousels } = await res.json();
        setSavedCarousels(carousels ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingCarousels(false);
    }
  }, []);

  useEffect(() => {
    fetchCarousels();
  }, [fetchCarousels]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const isUpdate = !!savedCarouselId;
      const url = isUpdate ? `/api/carousel/${savedCarouselId}` : "/api/carousel";
      const method = isUpdate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: carouselTitle, slidesJson: slides }),
      });

      if (isUpdate) {
        // Update existing entry in local list
        setSavedCarousels((prev) =>
          prev.map((c) =>
            c.id === savedCarouselId
              ? { ...c, title: carouselTitle, slidesJson: slides, updatedAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        const { carousel } = await res.json();
        if (carousel?.id) {
          setSavedId(carousel.id);
          setSavedCarousels((prev) => [carousel, ...prev]);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    setSavingTemplate(true);
    try {
      const templateTitle = `[Vorlage] ${carouselTitle || "Meine Vorlage"}`;
      const res = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: templateTitle, slidesJson: slides }),
      });
      if (res.ok) {
        const { carousel } = await res.json();
        if (carousel) setSavedCarousels((prev) => [carousel, ...prev]);
        setTab("saved");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteCarousel = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/carousel/${id}`, { method: "DELETE" });
      setSavedCarousels((prev) => prev.filter((c) => c.id !== id));
      if (savedCarouselId === id) setSavedId(null);
    } catch {
      fetchCarousels();
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadCarousel = (carousel: SavedCarousel) => {
    loadCarousel(carousel.id, carousel.title, carousel.slidesJson);
    setTab("elements");
    setMobileView("preview");
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
        a.download = `${carouselTitle.replace(/\s+/g, "-")}-slide-${i + 1}.png`;
        a.click();
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setExporting(false);
    }
  };

  const ControlsPanel = () => (
    <>
      <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: "var(--glass-border)" }}>
        {([
          { id: "elements" as Tab, label: "Text" },
          { id: "background" as Tab, label: "Design" },
          { id: "saved" as Tab, label: `Laden${savedCarousels.length ? ` (${savedCarousels.length})` : ""}` },
          { id: "templates" as Tab, label: "Vorlagen" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-shrink-0 px-3 py-2.5 text-[11px] font-medium transition-colors whitespace-nowrap",
              tab === t.id ? "text-white border-b-2 border-[#7c6af7]" : "text-white/30 hover:text-white/60"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "elements" && <ElementControls />}
        {tab === "background" && <BackgroundControls />}

        {tab === "saved" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/30">Gespeicherte Karussells</p>
              <button
                onClick={() => { newCarousel(); setTab("elements"); }}
                className="flex items-center gap-1 text-[11px] text-[#a78bfa] hover:text-white transition-colors"
              >
                <PlusIcon size={11} />
                Neu
              </button>
            </div>

            {loadingCarousels ? (
              <div className="flex items-center justify-center py-8">
                <LoaderIcon size={16} className="animate-spin text-white/30" />
              </div>
            ) : savedCarousels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-[11px] text-white/25">Noch nichts gespeichert</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedCarousels.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer",
                      savedCarouselId === c.id
                        ? "border-[#7c6af7]/40 bg-[#7c6af7]/10"
                        : "border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03]"
                    )}
                    onClick={() => handleLoadCarousel(c)}
                  >
                    <FolderOpenIcon size={12} className={cn("flex-shrink-0", savedCarouselId === c.id ? "text-[#a78bfa]" : "text-white/30")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{c.title}</p>
                      <p className="text-[10px] text-white/25">
                        {Array.isArray(c.slidesJson) ? c.slidesJson.length : 1} Slide{Array.isArray(c.slidesJson) && c.slidesJson.length !== 1 ? "s" : ""}
                        {" · "}
                        {new Date(c.updatedAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCarousel(c.id); }}
                      disabled={deletingId === c.id}
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                    >
                      {deletingId === c.id ? (
                        <LoaderIcon size={11} className="animate-spin" />
                      ) : (
                        <Trash2Icon size={11} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

      {/* Toolbar */}
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

        {savedCarouselId && (
          <span className="hidden sm:flex text-[10px] px-2 py-0.5 rounded-full bg-[#7c6af7]/15 text-[#a78bfa]/70 border border-[#7c6af7]/20 items-center gap-1">
            <BookmarkIcon size={9} />
            Gespeichert
          </span>
        )}

        <button
          onClick={handleSaveAsTemplate}
          disabled={savingTemplate}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 transition-all disabled:opacity-40"
          title="Als Vorlage speichern (separates Karussell)"
        >
          {savingTemplate ? <LoaderIcon size={12} className="animate-spin" /> : <LayoutTemplateIcon size={12} />}
          <span>Als Vorlage</span>
        </button>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white transition-all disabled:opacity-40"
        >
          {exporting ? <LoaderIcon size={12} className="animate-spin" /> : <DownloadIcon size={12} />}
          <span className="hidden sm:inline">Export PNG</span>
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
          <span className="hidden sm:inline">{saved ? "Gespeichert" : savedCarouselId ? "Aktualisieren" : "Speichern"}</span>
        </button>
      </div>

      {/* ── DESKTOP: 3-column layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden relative z-10">
        <div className="w-[160px] flex-shrink-0 flex flex-col border-r glass" style={{ borderColor: "var(--glass-border)" }}>
          <SlideList />
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {selectedSlide ? (
            <div
              className="w-full max-w-[380px] rounded-2xl overflow-hidden shadow-2xl"
              style={{ boxShadow: "0 0 60px rgba(124,106,247,0.15), 0 0 0 1px rgba(255,255,255,0.05)" }}
            >
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
        <div className="w-[260px] flex-shrink-0 flex flex-col border-l glass" style={{ borderColor: "var(--glass-border)" }}>
          <ControlsPanel />
        </div>
      </div>

      {/* ── MOBILE: tab layout ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative z-10">
        <div className="flex-shrink-0 flex border-b" style={{ background: "rgba(17,17,24,0.95)", borderColor: "var(--glass-border)" }}>
          {([
            { id: "preview" as MobileView, label: "Vorschau" },
            { id: "slides" as MobileView, label: `Slides (${slides.length})` },
            { id: "controls" as MobileView, label: "Bearbeiten" },
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

        <div className="flex-1 overflow-hidden">
          {mobileView === "preview" && (
            <div className="h-full overflow-auto flex items-center justify-center p-6">
              {selectedSlide ? (
                <div
                  className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl"
                  style={{ boxShadow: "0 0 40px rgba(124,106,247,0.2), 0 0 0 1px rgba(255,255,255,0.05)" }}
                >
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
