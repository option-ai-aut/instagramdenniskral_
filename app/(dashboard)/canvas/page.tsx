"use client";

import { useRef, useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DownloadIcon, SaveIcon, LoaderIcon, CheckIcon, BookmarkIcon, LayoutTemplateIcon } from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import { SlideList } from "@/components/canvas/SlideList";
import { SlidePreview } from "@/components/canvas/SlidePreview";
import { ControlsPanel, type SavedCarousel, type ControlsTab } from "@/components/canvas/ControlsPanel";
import { cn } from "@/lib/utils";

type MobileView = "preview" | "slides" | "controls";

function CanvasInner() {
  const searchParams = useSearchParams();
  const {
    slides, selectedSlideId, selectedElementId, carouselTitle, savedCarouselId,
    selectElement, setTitle, setSavedId, templates, loadTemplate, loadCarousel, newCarousel,
    grainIntensity,
  } = useCanvasStore();

  const selectedSlide = slides.find((s) => s.id === selectedSlideId);
  const slideRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<ControlsTab>("elements");
  const [mobileView, setMobileView] = useState<MobileView>("preview");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
  const [loadingCarousels, setLoadingCarousels] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [overwritingId, setOverwritingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const fetchCarousels = useCallback(async () => {
    setLoadingCarousels(true);
    try {
      const res = await fetch("/api/carousel");
      if (res.ok) {
        const { carousels } = await res.json();
        setSavedCarousels(carousels ?? []);
      }
    } catch { /* silent */ } finally {
      setLoadingCarousels(false);
    }
  }, []);

  useEffect(() => { fetchCarousels(); }, [fetchCarousels]);

  // Auto-load carousel when ?load=:id is in the URL (e.g. from Openclaw)
  useEffect(() => {
    const loadId = searchParams.get("load");
    if (!loadId) return;
    fetch(`/api/carousel/${loadId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.carousel) return;
        const c = data.carousel;
        loadCarousel(c.id, c.title, Array.isArray(c.slidesJson) ? c.slidesJson : []);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);

      if (isUpdate) {
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

  const handleLoadCarousel = useCallback((carousel: SavedCarousel) => {
    loadCarousel(carousel.id, carousel.title, carousel.slidesJson);
    setMobileView("preview");
  }, [loadCarousel]);

  const handleDeleteCarousel = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/carousel/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Löschen fehlgeschlagen (${res.status})`);
      setSavedCarousels((prev) => prev.filter((c) => c.id !== id));
      if (savedCarouselId === id) setSavedId(null);
    } catch {
      fetchCarousels();
    } finally {
      setDeletingId(null);
    }
  }, [savedCarouselId, setSavedId, fetchCarousels]);

  const handleOverwriteCarousel = useCallback(async (id: string) => {
    setOverwritingId(id);
    try {
      const res = await fetch(`/api/carousel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: carouselTitle, slidesJson: slides }),
      });
      if (!res.ok) throw new Error(`Überschreiben fehlgeschlagen (${res.status})`);
      setSavedCarousels((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, title: carouselTitle, slidesJson: slides, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } catch (e) {
      console.error(e);
      fetchCarousels();
    } finally {
      setOverwritingId(null);
    }
  }, [carouselTitle, slides, fetchCarousels]);

  const handleRenameCarousel = useCallback(async (id: string, title: string) => {
    setSavedCarousels((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
    try {
      await fetch(`/api/carousel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      fetchCarousels();
    }
  }, [fetchCarousels]);

  const handleDuplicateCarousel = useCallback(async (c: SavedCarousel) => {
    setDuplicatingId(c.id);
    try {
      const res = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Kopie – ${c.title}`, slidesJson: c.slidesJson }),
      });
      if (!res.ok) throw new Error("Duplizieren fehlgeschlagen");
      await fetchCarousels();
    } catch {
      fetchCarousels();
    } finally {
      setDuplicatingId(null);
    }
  }, [fetchCarousels]);

  const handleLoadTemplate = useCallback((id: string) => {
    loadTemplate(id);
    setMobileView("preview");
  }, [loadTemplate]);

  const handleNewCarousel = useCallback(() => {
    newCarousel();
    setTab("elements");
    setMobileView("preview");
  }, [newCarousel]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/canvas/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, title: carouselTitle, grainIntensity }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unbekannter Fehler" }));
        throw new Error(err.error ?? `Export fehlgeschlagen (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${carouselTitle.replace(/[^a-z0-9_\-]/gi, "-").toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert(err instanceof Error ? err.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const controlsPanelProps = {
    tab, setTab,
    savedCarousels, loadingCarousels, deletingId, overwritingId, duplicatingId, savedCarouselId,
    builtinTemplates: templates,
    onLoadCarousel: handleLoadCarousel,
    onDeleteCarousel: handleDeleteCarousel,
    onOverwriteCarousel: handleOverwriteCarousel,
    onRenameCarousel: handleRenameCarousel,
    onDuplicateCarousel: handleDuplicateCarousel,
    onNewCarousel: handleNewCarousel,
    onLoadTemplate: handleLoadTemplate,
  };

  return (
    <div className="flex flex-col h-full bg-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1d4ed8]/[0.03] via-transparent to-transparent pointer-events-none" />

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
          <span className="hidden sm:flex text-[10px] px-2 py-0.5 rounded-full bg-[#1d4ed8]/15 text-[#60a5fa]/70 border border-[#1d4ed8]/20 items-center gap-1 flex-shrink-0">
            <BookmarkIcon size={9} />
            Gespeichert
          </span>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white transition-all disabled:opacity-40 flex-shrink-0"
        >
          {exporting ? <LoaderIcon size={12} className="animate-spin" /> : <DownloadIcon size={12} />}
          <span className="hidden sm:inline">PNG</span>
        </button>

        <button
          onClick={() => { setTab("templates"); }}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 transition-all flex-shrink-0"
        >
          <LayoutTemplateIcon size={12} />
          <span>Vorlagen</span>
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border flex-shrink-0",
            saved
              ? "border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399]"
              : "border-[#1d4ed8]/30 text-[#60a5fa] hover:bg-[#1d4ed8]/10"
          )}
        >
          {saving ? <LoaderIcon size={12} className="animate-spin" /> : saved ? <CheckIcon size={12} /> : <SaveIcon size={12} />}
          <span className="hidden sm:inline">{saved ? "Gespeichert" : savedCarouselId ? "Aktualisieren" : "Speichern"}</span>
        </button>
      </div>

      {/* DESKTOP: 3-column */}
      <div className="hidden md:flex flex-1 overflow-hidden relative z-10">
        <div className="w-[160px] flex-shrink-0 flex flex-col border-r glass" style={{ borderColor: "var(--glass-border)" }}>
          <SlideList />
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {selectedSlide ? (
            <div
              className="w-full max-w-[380px] rounded-2xl overflow-hidden shadow-2xl"
              style={{ boxShadow: "0 0 60px rgba(29, 78, 216,0.15), 0 0 0 1px rgba(255,255,255,0.05)" }}
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
          <ControlsPanel {...controlsPanelProps} />
        </div>
      </div>

      {/* MOBILE: tab layout */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative z-10">
        <div
          className="flex-shrink-0 flex border-b"
          style={{ background: "rgba(17,17,24,0.95)", borderColor: "var(--glass-border)" }}
        >
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
                mobileView === v.id ? "text-[#60a5fa] border-[#1d4ed8]" : "text-white/30 border-transparent"
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
                  style={{ boxShadow: "0 0 40px rgba(29, 78, 216,0.2), 0 0 0 1px rgba(255,255,255,0.05)" }}
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
              <ControlsPanel {...controlsPanelProps} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-[#1d4ed8]/30 border-t-[#1d4ed8] animate-spin" /></div>}>
      <CanvasInner />
    </Suspense>
  );
}
