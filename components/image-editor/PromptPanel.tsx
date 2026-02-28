"use client";

import Image from "next/image";
import { SparklesIcon, SendHorizonal, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const { images, selectedId, setPrompt, updateImage } = useImageEditorStore();
  const selected = images.find((img) => img.id === selectedId);

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

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b flex-shrink-0 flex items-center justify-between" style={{ borderColor: "var(--glass-border)" }}>
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
        {/* Original preview */}
        <div className="aspect-square rounded-xl overflow-hidden relative border border-white/[0.06]">
          <Image
            src={selected.originalDataUrl}
            alt="Selected image"
            fill
            className="object-contain"
            sizes="400px"
            unoptimized
          />
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
              Mit Gemini generieren
            </>
          )}
        </button>
      </div>
    </div>
  );
}
