"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  InstagramIcon,
  LoaderIcon,
  XIcon,
  CheckIcon,
  DownloadCloudIcon,
  AlertCircleIcon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { base64ToDataUrl } from "@/lib/utils";

type ImportedImage = {
  base64: string;
  mimeType: string;
  index: number;
  sourceUrl: string;
};

type Props = {
  onImport: (images: Array<{ base64: string; mimeType: string; dataUrl: string }>) => void;
  disabled?: boolean;
};

export function InstagramImport({ onImport, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<ImportedImage[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setUrl("");
    setError(null);
    setFetched(null);
    setSelected(new Set());
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    setUrl("");
    setError(null);
    setFetched(null);
    setSelected(new Set());
  }, []);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setFetched(null);
    setSelected(new Set());

    try {
      const res = await fetch("/api/instagram/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Fehler beim Importieren");
        return;
      }

      setFetched(data.images);
      setSelected(new Set(data.images.map((img: ImportedImage) => img.index)));
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleImport = () => {
    if (!fetched) return;
    const toImport = fetched
      .filter((img) => selected.has(img.index))
      .map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
        dataUrl: base64ToDataUrl(img.base64, img.mimeType),
      }));
    if (toImport.length === 0) return;
    onImport(toImport);
    handleClose();
  };

  const isCarousel = fetched && fetched.length > 1;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-y-auto"
        style={{
          background: "rgba(17,17,24,0.98)",
          borderColor: "rgba(255,255,255,0.09)",
          boxShadow: "0 0 100px rgba(29, 78, 216,0.2), 0 0 0 1px rgba(255,255,255,0.05)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center gap-3 sticky top-0"
          style={{ background: "rgba(17,17,24,0.98)", borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
            }}
          >
            <InstagramIcon size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Von Instagram importieren</p>
            <p className="text-[10px] text-white/30">Öffentliche Posts &amp; Carousels</p>
          </div>
          <button
            onClick={handleClose}
            className="ml-auto text-white/30 hover:text-white/60 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* URL Input — shown before fetch result */}
          {!fetched && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-white/40 mb-2 block">Instagram Post-Link</label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) handleFetch();
                    }}
                    placeholder="https://www.instagram.com/p/..."
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-[#1d4ed8]/40 transition-colors"
                  />
                  <button
                    onClick={handleFetch}
                    disabled={loading || !url.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#1d4ed8]/80 hover:bg-[#1d4ed8] disabled:opacity-40 transition-all flex-shrink-0"
                  >
                    {loading ? (
                      <LoaderIcon size={14} className="animate-spin" />
                    ) : (
                      <DownloadCloudIcon size={14} />
                    )}
                    {loading ? "Lädt..." : "Laden"}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-white/20 leading-relaxed">
                Nur öffentliche Posts. Format: instagram.com/p/SHORTCODE/ oder /reel/SHORTCODE/
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl border border-[#f87171]/20 bg-[#f87171]/5">
              <AlertCircleIcon size={13} className="text-[#f87171] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#f87171]/80 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Results */}
          {fetched && (
            <div className="space-y-3">
              {/* Success banner */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#34d399]/5 border border-[#34d399]/15">
                <CheckIcon size={11} className="text-[#34d399] flex-shrink-0" />
                <p className="text-[11px] text-[#34d399]/80">
                  {fetched.length} Bild{fetched.length !== 1 ? "er" : ""} gefunden
                  {isCarousel ? " (Carousel)" : " (Einzelpost)"}
                </p>
                <button
                  onClick={() => {
                    setFetched(null);
                    setError(null);
                  }}
                  className="ml-auto text-white/20 hover:text-white/50 transition-colors"
                >
                  <XIcon size={11} />
                </button>
              </div>

              {/* Carousel grid */}
              {isCarousel && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-white/40">Welche Bilder importieren?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelected(new Set(fetched.map((i) => i.index)))}
                        className="text-[10px] text-[#60a5fa] hover:text-[#c4b5fd] transition-colors"
                      >
                        Alle
                      </button>
                      <span className="text-white/20">·</span>
                      <button
                        onClick={() => setSelected(new Set())}
                        className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                      >
                        Keine
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {fetched.map((img) => {
                      const dataUrl = base64ToDataUrl(img.base64, img.mimeType);
                      const isSel = selected.has(img.index);
                      return (
                        <button
                          key={img.index}
                          onClick={() => toggleSelect(img.index)}
                          className={cn(
                            "relative aspect-square rounded-xl overflow-hidden border-2 transition-all",
                            isSel
                              ? "border-[#1d4ed8] ring-1 ring-[#1d4ed8]/40"
                              : "border-transparent opacity-50 hover:opacity-75"
                          )}
                        >
                          <Image
                            src={dataUrl}
                            alt={`Slide ${img.index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          {isSel && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#1d4ed8] flex items-center justify-center">
                              <CheckIcon size={9} className="text-white" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-center py-0.5">
                            <span className="text-[9px] text-white/60">{img.index + 1}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Single image preview */}
              {!isCarousel && fetched[0] && (
                <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.06]" style={{ maxHeight: 320 }}>
                  <Image
                    src={base64ToDataUrl(fetched[0].base64, fetched[0].mimeType)}
                    alt="Post"
                    width={500}
                    height={500}
                    className="w-full object-contain"
                    unoptimized
                  />
                </div>
              )}

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1d4ed8]/80 hover:bg-[#1d4ed8] disabled:opacity-40 transition-all"
              >
                <DownloadCloudIcon size={14} />
                {selected.size === 0
                  ? "Kein Bild ausgewählt"
                  : `${selected.size} Bild${selected.size !== 1 ? "er" : ""} importieren`}
                {selected.size > 0 && <ChevronRightIcon size={12} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.07] text-[11px] text-white/40 hover:text-white/70 hover:border-white/15 transition-all disabled:opacity-30"
      >
        <InstagramIcon size={11} />
        Von Instagram importieren
      </button>

      {/* Portal: render modal on document.body to escape sidebar overflow clipping */}
      {mounted && open ? createPortal(modalContent, document.body) : null}
    </>
  );
}
