"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  SparklesIcon,
  LoaderIcon,
  DownloadIcon,
  MaximizeIcon,
  RefreshCwIcon,
  XIcon,
  CheckCircleIcon,
  BookmarkIcon,
  BookmarkCheckIcon,
  BrainCircuitIcon,
  ImageIcon,
  WandSparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadDataUrl } from "@/lib/utils";
import { useImageEditorStore } from "@/store/imageEditorStore";

type Props = {
  onGenerate: (id: string) => Promise<void>;
  onGenerateAll: () => Promise<void>;
  isGeneratingAll: boolean;
  onPromptsChange?: (count: number) => void;
};

type SavedPrompt = { id: string; text: string; createdAt: string };

export function PromptPanel({ onGenerate, onGenerateAll, isGeneratingAll, onPromptsChange }: Props) {
  const { images, selectedId, setPrompt, updateImage, useResultAsBase } = useImageEditorStore();
  const selected = images.find((img) => img.id === selectedId);
  const [lightbox, setLightbox] = useState(false);

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/prompts");
      if (res.ok) {
        const { prompts } = await res.json();
        const list = prompts ?? [];
        setSavedPrompts(list);
        onPromptsChange?.(list.length);
      }
    } catch {
      // silent – non-critical
    }
  }, [onPromptsChange]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleSavePrompt = async () => {
    if (!selected?.prompt.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selected.prompt.trim() }),
      });
      if (res.ok) {
        const { prompt } = await res.json();
        setSavedPrompts((prev) => {
          const updated = [prompt, ...prev];
          onPromptsChange?.(updated.length);
          return updated;
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    setSavedPrompts((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      onPromptsChange?.(updated.length);
      return updated;
    });
    try {
      await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    } catch {
      // re-fetch on error
      fetchPrompts();
    }
  };

  if (!selected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
          <SparklesIcon size={24} className="text-[#1d4ed8]/50" />
        </div>
        <p className="text-sm text-white/30 text-center">
          Lade Bilder hoch und wähle eines aus, um zu starten
        </p>
      </div>
    );
  }

  const isProcessing = selected.status === "processing";
  const hasResult = !!selected.resultDataUrl;
  // When result exists and user hasn't toggled to original: show result
  const viewingOriginal = hasResult && showOriginal;
  const previewSrc = viewingOriginal ? selected.originalDataUrl : (hasResult ? selected.resultDataUrl! : selected.originalDataUrl);

  const handleDownload = () => {
    downloadDataUrl(selected.resultDataUrl!, `denniskral_${selected.id}.png`);
  };

  const isAlreadySaved = savedPrompts.some(
    (p) => p.text.trim() === selected.prompt.trim()
  );

  return (
    <>
      {/* ── Desktop: image left | controls right ── */}
      <div className="hidden md:flex h-full">

        {/* Image column – fills available height, always shows full image */}
        <div className="flex-1 flex flex-col min-w-0 p-4">
          <div
            className={cn(
              "flex-1 min-h-0 relative rounded-2xl overflow-hidden border",
              hasResult && !viewingOriginal ? "border-[#1d4ed8]/30" : "border-white/[0.06]",
              hasResult ? "cursor-zoom-in" : ""
            )}
            onClick={() => hasResult && !viewingOriginal && setLightbox(true)}
          >
            <Image
              src={previewSrc}
              alt={viewingOriginal ? "Original" : hasResult ? "KI Ergebnis" : "Original"}
              fill
              className="object-contain"
              sizes="(max-width: 1280px) 60vw, 800px"
              unoptimized
            />

            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 backdrop-blur-sm">
                <LoaderIcon size={26} className="text-[#60a5fa] animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-white/80">Gemini arbeitet…</p>
                  <p className="text-[10px] text-white/40">Stil analysieren → Bild bearbeiten</p>
                </div>
              </div>
            )}

            {/* Badge: Original / KI Ergebnis */}
            {!isProcessing && (
              <div className={cn(
                "absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-sm border",
                viewingOriginal
                  ? "bg-black/60 text-white/70 border-white/10"
                  : hasResult
                  ? "bg-[#1d4ed8]/80 text-white border-[#60a5fa]/30"
                  : "bg-black/60 text-white/50 border-white/10"
              )}>
                {viewingOriginal ? <ImageIcon size={10} /> : hasResult ? <CheckCircleIcon size={10} /> : <ImageIcon size={10} />}
                {viewingOriginal ? "Original" : hasResult ? "KI Ergebnis" : "Original"}
              </div>
            )}

            {/* Maximize hint */}
            {hasResult && !isProcessing && !viewingOriginal && (
              <div className="absolute top-3 right-3">
                <div className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
                  <MaximizeIcon size={12} className="text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons below image */}
          {hasResult && !isProcessing && (
            <div className="mt-3 flex gap-2 flex-shrink-0">
              {/* Toggle Original / Ergebnis */}
              <button
                onClick={() => setShowOriginal((v) => !v)}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium border transition-all",
                  viewingOriginal
                    ? "border-[#1d4ed8]/40 text-[#60a5fa] bg-[#1d4ed8]/10"
                    : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                )}
              >
                {viewingOriginal ? <WandSparklesIcon size={11} /> : <ImageIcon size={11} />}
                {viewingOriginal ? "Ergebnis" : "Original"}
              </button>
              <button
                onClick={() => useResultAsBase(selected.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium border border-[#1d4ed8]/25 text-[#60a5fa] hover:bg-[#1d4ed8]/10 transition-all"
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

        {/* Controls column – fixed width, scrollable */}
        <div
          className="w-[320px] flex-shrink-0 flex flex-col border-l"
          style={{ borderColor: "var(--glass-border)" }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b flex-shrink-0 flex items-center justify-between"
            style={{ borderColor: "var(--glass-border)" }}
          >
            <p className="text-xs font-medium text-white/60">Prompt & Generierung</p>
            {images.length > 1 && (
              <button
                onClick={onGenerateAll}
                disabled={isGeneratingAll}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-all border border-[#1d4ed8]/30 text-[#60a5fa] hover:bg-[#1d4ed8]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isGeneratingAll ? <LoaderIcon size={11} className="animate-spin" /> : <SparklesIcon size={11} />}
                Alle ({images.filter(i => i.prompt && i.status !== "done" && i.status !== "processing").length}/{images.length})
              </button>
            )}
          </div>

          {/* Scrollable controls */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Prompt input */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[11px] text-white/40">Dein Prompt</label>
                {selected.aiDerivedPrompt && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/15 text-[#60a5fa]/80 border border-[#1d4ed8]/20">
                    <BrainCircuitIcon size={9} />
                    KI analysiert
                  </span>
                )}
              </div>
              <textarea
                value={selected.prompt}
                onChange={(e) => {
                  setPrompt(selected.id, e.target.value);
                  if (selected.aiDerivedPrompt) updateImage(selected.id, { aiDerivedPrompt: false });
                }}
                placeholder="Beschreibe wie das Bild bearbeitet werden soll..."
                rows={4}
                maxLength={2000}
                className="w-full rounded-xl border text-sm text-white/80 placeholder-white/20 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]/50 transition-colors"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-white/20">{selected.prompt.length}/2000</span>
                <button
                  onClick={handleSavePrompt}
                  disabled={saving || !selected.prompt.trim() || isAlreadySaved}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border",
                    saveSuccess
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : isAlreadySaved
                      ? "border-white/10 text-white/25 cursor-default"
                      : "border-[#1d4ed8]/30 text-[#60a5fa] hover:bg-[#1d4ed8]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {saving ? <LoaderIcon size={11} className="animate-spin" /> : saveSuccess ? <BookmarkCheckIcon size={11} /> : <BookmarkIcon size={11} />}
                  {saveSuccess ? "Gespeichert!" : isAlreadySaved ? "Bereits gespeichert" : "Prompt speichern"}
                </button>
              </div>
            </div>

            {/* Saved prompts */}
            <div>
              <p className="text-[10px] text-white/25 mb-2">
                Gespeicherte Prompts
                {savedPrompts.length > 0 && (
                  <span className="ml-1.5 text-[#1d4ed8]/60">({savedPrompts.length})</span>
                )}
              </p>
              {savedPrompts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                  <p className="text-[11px] text-white/25 leading-relaxed">
                    Noch keine Prompts gespeichert. Gespeicherte Prompts werden von der KI analysiert,
                    um zukünftig automatisch den passenden Stil für deine Bilder zu wählen.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {savedPrompts.map((p) => (
                    <div
                      key={p.id}
                      className="group flex items-start gap-2 w-full text-left text-[11px] text-white/40 hover:text-white/70 px-3 py-2 rounded-lg border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] transition-all cursor-pointer"
                      onClick={() => setPrompt(selected.id, p.text)}
                    >
                      <span className="flex-1 leading-relaxed">{p.text}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePrompt(p.id); }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-white/30 hover:text-red-400 transition-all"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Generate button */}
          <div className="px-4 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
            <button
              onClick={() => onGenerate(selected.id)}
              disabled={isProcessing || !selected.prompt.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
                isProcessing || !selected.prompt.trim()
                  ? "bg-white/[0.04] text-white/20 cursor-not-allowed"
                  : "text-white glow-accent hover:opacity-90 active:scale-[0.98]"
              )}
              style={!isProcessing && selected.prompt.trim() ? { background: "linear-gradient(135deg, #1d4ed8, #60a5fa)" } : {}}
            >
              {isProcessing ? (
                <><LoaderIcon size={16} className="animate-spin" />Generiert...</>
              ) : (
                <><SparklesIcon size={16} />{hasResult ? "Erneut generieren" : "Mit Gemini generieren"}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile: stacked layout ── */}
      <div className="flex md:hidden flex-col h-full">
        <div
          className="px-4 py-3 border-b flex-shrink-0 flex items-center justify-between"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <p className="text-xs font-medium text-white/60">Prompt & Generierung</p>
          {images.length > 1 && (
            <button
              onClick={onGenerateAll}
              disabled={isGeneratingAll}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border border-[#1d4ed8]/30 text-[#60a5fa] hover:bg-[#1d4ed8]/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGeneratingAll ? <LoaderIcon size={11} className="animate-spin" /> : <SparklesIcon size={11} />}
              Alle ({images.filter(i => i.prompt && i.status !== "done" && i.status !== "processing").length}/{images.length})
            </button>
          )}
        </div>

        {/* Image – fixed height on mobile */}
        <div
          className={cn(
            "relative flex-shrink-0 border-b",
            "h-[45vw] min-h-[180px] max-h-[280px]",
          )}
          style={{ borderColor: "var(--glass-border)" }}
          onClick={() => hasResult && !viewingOriginal && setLightbox(true)}
        >
          <Image
            src={previewSrc}
            alt={viewingOriginal ? "Original" : hasResult ? "KI Ergebnis" : "Original"}
            fill
            className={cn("object-contain", hasResult && !viewingOriginal && "cursor-zoom-in")}
            sizes="100vw"
            unoptimized
          />
          {isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 backdrop-blur-sm">
              <LoaderIcon size={22} className="text-[#60a5fa] animate-spin" />
              <p className="text-[11px] text-white/60">Gemini arbeitet…</p>
            </div>
          )}
          {!isProcessing && (
            <div className={cn(
              "absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-sm border",
              viewingOriginal ? "bg-black/60 text-white/70 border-white/10" : hasResult ? "bg-[#1d4ed8]/80 text-white border-[#60a5fa]/30" : "bg-black/60 text-white/50 border-white/10"
            )}>
              {viewingOriginal ? <ImageIcon size={10} /> : hasResult ? <CheckCircleIcon size={10} /> : <ImageIcon size={10} />}
              {viewingOriginal ? "Original" : hasResult ? "KI Ergebnis" : "Original"}
            </div>
          )}
        </div>

        {/* Mobile action buttons */}
        {hasResult && !isProcessing && (
          <div className="flex gap-2 px-4 py-2 flex-shrink-0 border-b" style={{ borderColor: "var(--glass-border)" }}>
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                viewingOriginal ? "border-[#1d4ed8]/40 text-[#60a5fa] bg-[#1d4ed8]/10" : "border-white/10 text-white/50"
              )}
            >
              {viewingOriginal ? <WandSparklesIcon size={11} /> : <ImageIcon size={11} />}
              {viewingOriginal ? "KI" : "Original"}
            </button>
            <button onClick={() => useResultAsBase(selected.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium border border-[#1d4ed8]/25 text-[#60a5fa] hover:bg-[#1d4ed8]/10 transition-all">
              <RefreshCwIcon size={11} />Als Original
            </button>
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium border border-white/10 text-white/60 hover:text-white transition-all">
              <DownloadIcon size={11} />Download
            </button>
            <button onClick={() => setLightbox(true)} className="w-9 flex items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white transition-all">
              <MaximizeIcon size={13} />
            </button>
          </div>
        )}

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[11px] text-white/40">Dein Prompt</label>
              {selected.aiDerivedPrompt && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/15 text-[#60a5fa]/80 border border-[#1d4ed8]/20">
                  <BrainCircuitIcon size={9} />
                  KI analysiert
                </span>
              )}
            </div>
            <textarea
              value={selected.prompt}
              onChange={(e) => {
                setPrompt(selected.id, e.target.value);
                if (selected.aiDerivedPrompt) updateImage(selected.id, { aiDerivedPrompt: false });
              }}
              placeholder="Beschreibe wie das Bild bearbeitet werden soll..."
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl border text-sm text-white/80 placeholder-white/20 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]/50 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-white/20">{selected.prompt.length}/2000</span>
              <button
                onClick={handleSavePrompt}
                disabled={saving || !selected.prompt.trim() || isAlreadySaved}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border",
                  saveSuccess ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : isAlreadySaved ? "border-white/10 text-white/25 cursor-default"
                    : "border-[#1d4ed8]/30 text-[#60a5fa] hover:bg-[#1d4ed8]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {saving ? <LoaderIcon size={11} className="animate-spin" /> : saveSuccess ? <BookmarkCheckIcon size={11} /> : <BookmarkIcon size={11} />}
                {saveSuccess ? "Gespeichert!" : isAlreadySaved ? "Bereits gespeichert" : "Prompt speichern"}
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-white/25 mb-2">
              Gespeicherte Prompts
              {savedPrompts.length > 0 && <span className="ml-1.5 text-[#1d4ed8]/60">({savedPrompts.length})</span>}
            </p>
            {savedPrompts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-[11px] text-white/25 leading-relaxed">Noch keine Prompts gespeichert.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedPrompts.map((p) => (
                  <div key={p.id} className="group flex items-start gap-2 w-full text-left text-[11px] text-white/40 hover:text-white/70 px-3 py-2 rounded-lg border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] transition-all cursor-pointer"
                    onClick={() => setPrompt(selected.id, p.text)}>
                    <span className="flex-1 leading-relaxed">{p.text}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePrompt(p.id); }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-white/30 hover:text-red-400 transition-all">
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate button */}
        <div className="px-4 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
          <button
            onClick={() => onGenerate(selected.id)}
            disabled={isProcessing || !selected.prompt.trim()}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
              isProcessing || !selected.prompt.trim() ? "bg-white/[0.04] text-white/20 cursor-not-allowed" : "text-white glow-accent hover:opacity-90 active:scale-[0.98]"
            )}
            style={!isProcessing && selected.prompt.trim() ? { background: "linear-gradient(135deg, #1d4ed8, #60a5fa)" } : {}}
          >
            {isProcessing ? <><LoaderIcon size={16} className="animate-spin" />Generiert...</> : <><SparklesIcon size={16} />{hasResult ? "Erneut generieren" : "Mit Gemini generieren"}</>}
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
