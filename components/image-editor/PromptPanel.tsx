"use client";

import { useState } from "react";
import Image from "next/image";
import { SparklesIcon, SendHorizonal, LoaderIcon, DownloadIcon, MaximizeIcon, RefreshCwIcon, XIcon, CheckCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadDataUrl } from "@/lib/utils";
import { useImageEditorStore } from "@/store/imageEditorStore";

type Props = {
  onGenerate: (id: string) => Promise<void>;
  onGenerateAll: () => Promise<void>;
  isGeneratingAll: boolean;
};

const PROMPT_SUGGESTIONS = [
  "Luxury car photography, cinematic lighting, dark background",
  "Premium lifestyle edit, warm golden tones, film grain",
  "Entrepreneur aesthetic, clean modern office, soft light",
  "High-end fashion photo, dramatic shadows, black and white",
  "Motivational post, bold contrast, moody atmosphere",
];

export function PromptPanel({ onGenerate, onGenerateAll, isGeneratingAll }: Props) {
  const { images, selectedId, setPrompt, updateImage, useResultAsBase } = useImageEditorStore();
  const selected = images.find((img) => img.id === selectedId);
  const [lightbox, setLightbox] = useState(false);

  if (!selected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
          <SparklesIcon size={24} className="text-[#7c6af7]/50" />
        </div>
        <p className="text-sm text-white/30 text-center">
          Lade Bilder hoch und wähle eines aus, um zu starten
        </p>
      </div>
    );
  }

  const isProcessing = selected.status === "processing";
  const hasResult = !!selected.resultDataUrl;
  const previewSrc = hasResult ? selected.resultDataUrl! : selected.originalDataUrl;

  const handleDownload = () => {
    downloadDataUrl(selected.resultDataUrl!, `denniskral_${selected.id}.png`);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div
          className="px-5 py-3 border-b flex-shrink-0 flex items-center justify-between"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <p className="text-xs font-medium text-white/60">Prompt & Generierung</p>
          {images.length > 1 && (
            <button
              onClick={onGenerateAll}
              disabled={isGeneratingAll}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border border-[#7c6af7]/30 text-[#a78bfa] hover:bg-[#7c6af7]/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGeneratingAll ? (
                <LoaderIcon size={11} className="animate-spin" />
              ) : (
                <SparklesIcon size={11} />
              )}
              Alle senden ({images.filter(i => i.prompt).length}/{images.length})
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Preview — shows result if available, otherwise original */}
          <div className="relative">
            <div
              className={cn(
                "aspect-square rounded-xl overflow-hidden relative border cursor-zoom-in",
                hasResult ? "border-[#7c6af7]/30" : "border-white/[0.06]"
              )}
              onClick={() => hasResult && setLightbox(true)}
            >
              <Image
                src={previewSrc}
                alt={hasResult ? "KI Ergebnis" : "Original"}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 480px"
                unoptimized
              />

              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
                  <LoaderIcon size={28} className="text-[#a78bfa] animate-spin" />
                  <span className="text-xs text-white/70">Generiert mit Gemini…</span>
                </div>
              )}

              {/* Tag: KI Ergebnis */}
              {hasResult && !isProcessing && (
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#7c6af7]/80 backdrop-blur-sm text-white border border-[#a78bfa]/30">
                  <CheckCircleIcon size={10} />
                  KI Ergebnis
                </div>
              )}

              {/* Zoom hint */}
              {hasResult && !isProcessing && (
                <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center">
                    <MaximizeIcon size={12} className="text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Result actions below preview */}
            {hasResult && !isProcessing && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => useResultAsBase(selected.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium border border-[#7c6af7]/25 text-[#a78bfa] hover:bg-[#7c6af7]/10 transition-all"
                >
                  <RefreshCwIcon size={11} />
                  Als Original
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
                >
                  <DownloadIcon size={11} />
                  Download
                </button>
                <button
                  onClick={() => setLightbox(true)}
                  className="w-9 flex items-center justify-center rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
                >
                  <MaximizeIcon size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Prompt input */}
          <div>
            <label className="text-[11px] text-white/40 mb-2 block">Dein Prompt</label>
            <textarea
              value={selected.prompt}
              onChange={(e) => setPrompt(selected.id, e.target.value)}
              placeholder="Beschreibe wie das Bild bearbeitet werden soll..."
              rows={3}
              className="w-full rounded-xl border text-sm text-white/80 placeholder-white/20 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-[#7c6af7]/50 transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-[10px] text-white/25 mb-2">Vorschläge für @denniskral_</p>
            <div className="space-y-1.5">
              {PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPrompt(selected.id, s);
                    updateImage(selected.id, { prompt: s });
                  }}
                  className="w-full text-left text-[11px] text-white/40 hover:text-white/70 px-3 py-2 rounded-lg border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
          <button
            onClick={() => onGenerate(selected.id)}
            disabled={isProcessing || !selected.prompt.trim()}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
              isProcessing || !selected.prompt.trim()
                ? "bg-white/[0.04] text-white/20 cursor-not-allowed"
                : "text-white glow-accent hover:opacity-90 active:scale-[0.98]"
            )}
            style={
              !isProcessing && selected.prompt.trim()
                ? { background: "linear-gradient(135deg, #7c6af7, #a78bfa)" }
                : {}
            }
          >
            {isProcessing ? (
              <>
                <LoaderIcon size={16} className="animate-spin" />
                Generiert...
              </>
            ) : (
              <>
                <SparklesIcon size={16} />
                {hasResult ? "Erneut generieren" : "Mit Gemini generieren"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && hasResult && (
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
              src={selected.resultDataUrl!}
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
