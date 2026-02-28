"use client";

import { LayoutTemplateIcon, LoaderIcon, PlusIcon, Trash2Icon, FolderOpenIcon, SaveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ElementControls } from "./ElementControls";
import { BackgroundControls } from "./BackgroundControls";
import type { Template, Slide } from "@/store/canvasStore";

export type SavedCarousel = {
  id: string;
  title: string;
  slidesJson: Slide[];
  updatedAt: string;
};

export type ControlsTab = "elements" | "background" | "templates";

type Props = {
  tab: ControlsTab;
  setTab: (t: ControlsTab) => void;
  savedCarousels: SavedCarousel[];
  loadingCarousels: boolean;
  deletingId: string | null;
  overwritingId: string | null;
  savedCarouselId: string | null;
  carouselTitle: string;
  currentSlides: Slide[];
  builtinTemplates: Template[];
  onLoadCarousel: (c: SavedCarousel) => void;
  onDeleteCarousel: (id: string) => void;
  onOverwriteCarousel: (id: string) => void;
  onNewCarousel: () => void;
  onLoadTemplate: (id: string) => void;
};

const BUILT_IN_ICONS: Record<string, string> = {
  progress: "📈",
  tip: "💡",
  luxury: "✨",
};

export function ControlsPanel({
  tab, setTab,
  savedCarousels, loadingCarousels, deletingId, overwritingId, savedCarouselId,
  builtinTemplates,
  onLoadCarousel, onDeleteCarousel, onOverwriteCarousel, onNewCarousel, onLoadTemplate,
}: Props) {
  const tabs: { id: ControlsTab; label: string }[] = [
    { id: "elements", label: "Text" },
    { id: "background", label: "Design" },
    { id: "templates", label: `Vorlagen${savedCarousels.length ? ` (${savedCarousels.length})` : ""}` },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-2.5 text-[11px] font-medium transition-colors",
              tab === t.id
                ? "text-white border-b-2 border-[#7c6af7]"
                : "text-white/30 hover:text-white/60"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "elements" && <ElementControls />}
        {tab === "background" && <BackgroundControls />}

        {tab === "templates" && (
          <div className="p-4 space-y-5">

            {/* ── Meine Karussells ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Meine Karussells</p>
                <button
                  onClick={onNewCarousel}
                  className="flex items-center gap-1 text-[11px] text-[#a78bfa] hover:text-white transition-colors"
                >
                  <PlusIcon size={11} />
                  Neu
                </button>
              </div>

              {loadingCarousels ? (
                <div className="flex items-center justify-center py-6">
                  <LoaderIcon size={15} className="animate-spin text-white/20" />
                </div>
              ) : savedCarousels.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-4 text-center">
                  <p className="text-[11px] text-white/20">Noch nichts gespeichert</p>
                  <p className="text-[10px] text-white/15 mt-0.5">Nutze „Speichern" in der Toolbar</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {savedCarousels.map((c) => {
                    const isActive = savedCarouselId === c.id;
                    const slideCount = Array.isArray(c.slidesJson) ? c.slidesJson.length : 1;
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "group rounded-xl border transition-all",
                          isActive
                            ? "border-[#7c6af7]/40 bg-[#7c6af7]/10"
                            : "border-white/[0.06] hover:border-white/[0.12]"
                        )}
                      >
                        {/* Title row */}
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                          onClick={() => onLoadCarousel(c)}
                        >
                          <FolderOpenIcon size={12} className={cn("flex-shrink-0", isActive ? "text-[#a78bfa]" : "text-white/25")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/70 truncate">{c.title}</p>
                            <p className="text-[10px] text-white/25">
                              {slideCount} Slide{slideCount !== 1 ? "s" : ""} · {new Date(c.updatedAt).toLocaleDateString("de-DE")}
                            </p>
                          </div>
                          {isActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#7c6af7]/20 text-[#a78bfa] border border-[#7c6af7]/30 flex-shrink-0">
                              Aktiv
                            </span>
                          )}
                        </button>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 px-3 pb-2">
                          {isActive && (
                            <button
                              onClick={() => onOverwriteCarousel(c.id)}
                              disabled={overwritingId === c.id}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-[#7c6af7]/20 text-[#a78bfa]/70 hover:text-[#a78bfa] hover:border-[#7c6af7]/40 transition-all disabled:opacity-40"
                            >
                              {overwritingId === c.id
                                ? <LoaderIcon size={9} className="animate-spin" />
                                : <SaveIcon size={9} />
                              }
                              Überschreiben
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteCarousel(c.id)}
                            disabled={deletingId === c.id}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-white/[0.06] text-white/25 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-40 ml-auto"
                          >
                            {deletingId === c.id
                              ? <LoaderIcon size={9} className="animate-spin" />
                              : <Trash2Icon size={9} />
                            }
                            Löschen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Basis-Vorlagen ── */}
            <div>
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2">Basis-Vorlagen</p>
              <p className="text-[10px] text-white/20 mb-2">Ersetzt alle aktuellen Slides</p>
              <div className="space-y-1.5">
                {builtinTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => onLoadTemplate(tpl.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.06] text-xs text-white/50 hover:text-white hover:border-white/20 transition-all text-left"
                  >
                    <span className="text-sm">{BUILT_IN_ICONS[tpl.id] ?? <LayoutTemplateIcon size={13} className="text-[#7c6af7]" />}</span>
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
