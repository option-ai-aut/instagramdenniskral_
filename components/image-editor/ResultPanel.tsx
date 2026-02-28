"use client";

import { useState } from "react";
import Image from "next/image";
import { DownloadIcon, MaximizeIcon, RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react";
import { downloadDataUrl, base64ToDataUrl } from "@/lib/utils";
import { useImageEditorStore } from "@/store/imageEditorStore";

export function ResultPanel() {
  const { images, selectedId, useResultAsBase } = useImageEditorStore();
  const [lightbox, setLightbox] = useState(false);
  const selected = images.find((img) => img.id === selectedId);

  if (!selected?.resultDataUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
          <SparklesIcon size={24} className="text-white/10" />
        </div>
        <p className="text-xs text-white/20 text-center">
          Hier erscheint dein generiertes Bild
        </p>
      </div>
    );
  }

  const handleDownload = () => {
    downloadDataUrl(
      selected.resultDataUrl!,
      `denniskral_${selected.id}.png`
    );
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div
          className="px-5 py-3 border-b flex-shrink-0 flex items-center justify-between"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <p className="text-xs font-medium text-white/60">Ergebnis</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full status-done">
            Gemini Nano Banana Pro
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Result image */}
          <div
            className="aspect-square rounded-xl overflow-hidden relative border border-[#7c6af7]/20 cursor-zoom-in"
            onClick={() => setLightbox(true)}
          >
            <Image
              src={selected.resultDataUrl}
              alt="Generated result"
              fill
              className="object-contain"
              sizes="400px"
              unoptimized
            />
            <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center">
                <MaximizeIcon size={12} className="text-white" />
              </div>
            </div>
          </div>

          {/* Prompt used */}
          {selected.prompt && (
            <div className="rounded-xl p-3 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] text-white/30 mb-1">Verwendeter Prompt</p>
              <p className="text-xs text-white/60 leading-relaxed">{selected.prompt}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t flex-shrink-0 space-y-2" style={{ borderColor: "var(--glass-border)" }}>
          <button
            onClick={() => useResultAsBase(selected.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border border-[#7c6af7]/25 text-[#a78bfa] hover:bg-[#7c6af7]/10 transition-all"
          >
            <RefreshCwIcon size={13} />
            Als neues Original verwenden
          </button>

          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            <DownloadIcon size={13} />
            Herunterladen
          </button>

          <button
            onClick={() => setLightbox(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            <MaximizeIcon size={13} />
            Vergrößern
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full glass flex items-center justify-center"
            onClick={() => setLightbox(false)}
          >
            <XIcon size={16} className="text-white/60" />
          </button>
          <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={selected.resultDataUrl}
              alt="Full size result"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl"
            />
            <button
              onClick={handleDownload}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/10 text-xs text-white/70 hover:text-white transition-colors"
            >
              <DownloadIcon size={12} />
              Download
            </button>
          </div>
        </div>
      )}
    </>
  );
}
