"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ImageList } from "@/components/image-editor/ImageList";
import { PromptPanel } from "@/components/image-editor/PromptPanel";
import { useImageEditorStore } from "@/store/imageEditorStore";
import { base64ToDataUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ImageIcon, SparklesIcon, BrainCircuitIcon, LoaderIcon } from "lucide-react";

type MobileTab = "images" | "prompt";

const mobileTabs: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: "images", label: "Bilder", icon: ImageIcon },
  { id: "prompt", label: "Prompt & Ergebnis", icon: SparklesIcon },
];

export default function ImageEditorPage() {
  const { images, sessionId, setSessionId, updateImage, selectedId } = useImageEditorStore();
  const [mobileTab, setMobileTab] = useState<MobileTab>("images");
  const initDone = useRef(false);

  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [savedPromptsCount, setSavedPromptsCount] = useState<number | null>(null);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    // Only create a new session if none exists yet (prevents recreation on back-navigation)
    if (!sessionId) {
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Session " + new Date().toLocaleDateString("de-DE") }),
      })
        .then((r) => r.json())
        .then(({ session }) => {
          if (session?.id) setSessionId(session.id);
        })
        .catch(console.error);
    }

    fetch("/api/prompts")
      .then((r) => r.json())
      .then(({ prompts }) => setSavedPromptsCount(prompts?.length ?? 0))
      .catch(() => setSavedPromptsCount(0));
  }, [setSessionId, sessionId]);

  const generateSingle = async (imageId: string) => {
    const img = images.find((i) => i.id === imageId);
    if (!img || !img.prompt.trim() || img.status === "processing") return;

    updateImage(imageId, { status: "processing", error: undefined });

    let dbId = img.dbId;
    if (!dbId && sessionId) {
      try {
        const r = await fetch(`/api/sessions/${sessionId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: img.originalBase64, mimeType: img.mimeType }),
        });
        const { item } = await r.json();
        dbId = item?.id;
        updateImage(imageId, { dbId, sessionId });
      } catch (e) {
        console.error("Failed to save original:", e);
      }
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageItemId: dbId ?? `temp-${imageId}`,
          imageBase64: img.originalBase64,
          mimeType: img.mimeType,
          prompt: img.prompt,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Generation failed");
      }

      const { resultBase64, mimeType } = await res.json();
      const resultDataUrl = base64ToDataUrl(resultBase64, mimeType);

      updateImage(imageId, { status: "done", resultDataUrl, resultBase64, resultMimeType: mimeType });
      setMobileTab("prompt");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler";
      updateImage(imageId, { status: "error", error: message });
    }
  };

  const generateAll = async () => {
    const pending = images.filter(
      (img) => img.prompt.trim() && img.status !== "processing" && img.status !== "done"
    );
    await Promise.allSettled(pending.map((img) => generateSingle(img.id)));
  };

  const handleSmartGenerate = useCallback(async () => {
    if (images.length === 0 || smartLoading) return;
    setSmartError(null);
    setSmartLoading(true);

    // Mark all images as processing
    images.forEach((img) => updateImage(img.id, { status: "processing", error: undefined }));

    try {
      const promptsRes = await fetch("/api/prompts");
      const { prompts } = await promptsRes.json();

      if (!prompts || prompts.length === 0) {
        setSmartError("Noch keine Prompts gespeichert. Speichere zuerst einige Prompts.");
        images.forEach((img) => updateImage(img.id, { status: "idle" }));
        return;
      }

      const savedPromptTexts: string[] = prompts.map((p: { text: string }) => p.text);

      const res = await fetch("/api/generate/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => ({
            imageBase64: img.originalBase64,
            mimeType: img.mimeType,
            imageItemId: img.dbId ?? `temp-${img.id}`,
          })),
          savedPrompts: savedPromptTexts,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Smart generation failed");
      }

      const { results } = await res.json();

      for (const result of results) {
        const localImg = images.find(
          (img) => (img.dbId ?? `temp-${img.id}`) === result.imageItemId
        );
        if (!localImg) continue;

        if (result.error) {
          updateImage(localImg.id, { status: "error", error: result.error });
        } else {
          const resultDataUrl = base64ToDataUrl(result.resultBase64, result.mimeType);
          updateImage(localImg.id, {
            status: "done",
            resultDataUrl,
            resultBase64: result.resultBase64,
            resultMimeType: result.mimeType,
            prompt: result.derivedPrompt,
          });
        }
      }

      setMobileTab("prompt");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler";
      setSmartError(message);
      images.forEach((img) => updateImage(img.id, { status: "error", error: message }));
    } finally {
      setSmartLoading(false);
    }
  }, [images, smartLoading, updateImage]);

  const isGeneratingAll = images.some((img) => img.status === "processing");
  const hasImages = images.length > 0;
  const hasNoSavedPrompts = savedPromptsCount === 0;

  const handleMobileImageSelect = () => {
    setMobileTab("prompt");
  };

  const SmartButton = (
    <div className="relative">
      <button
        onClick={handleSmartGenerate}
        disabled={!hasImages || smartLoading || isGeneratingAll || hasNoSavedPrompts}
        title={
          hasNoSavedPrompts
            ? "Speichere zuerst einige Prompts, damit die KI deinen Stil kennt"
            : !hasImages
            ? "Lade zuerst Bilder hoch"
            : undefined
        }
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border",
          !hasImages || hasNoSavedPrompts || isGeneratingAll
            ? "border-white/10 text-white/25 cursor-not-allowed bg-transparent"
            : smartLoading
            ? "border-[#7c6af7]/30 text-[#a78bfa]/60 cursor-not-allowed"
            : "border-[#7c6af7]/40 text-[#a78bfa] hover:bg-[#7c6af7]/10 active:scale-[0.98]"
        )}
      >
        {smartLoading ? (
          <LoaderIcon size={15} className="animate-spin" />
        ) : (
          <BrainCircuitIcon size={15} />
        )}
        <span className="hidden sm:inline">
          {smartLoading ? "KI analysiert…" : "Mit KI generieren"}
        </span>
        <span className="sm:hidden">
          {smartLoading ? "KI…" : "Mit KI"}
        </span>
        {savedPromptsCount !== null && savedPromptsCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#7c6af7]/20 text-[#a78bfa]/80">
            {savedPromptsCount} Prompts
          </span>
        )}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Top bar with smart generate button */}
      <div
        className="relative z-10 flex-shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: "rgba(17,17,24,0.8)", borderColor: "var(--glass-border)" }}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-white/80">Image Editor</h1>
          {hasImages && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">
              {images.length} Bild{images.length !== 1 ? "er" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {smartError && (
            <span className="text-[11px] text-red-400 max-w-[200px] truncate">{smartError}</span>
          )}
          {SmartButton}
        </div>
      </div>

      {/* ── DESKTOP: 2-column layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden relative z-10 h-full">
        <div
          className="w-[200px] flex-shrink-0 flex flex-col border-r glass"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <ImageList />
        </div>
        <div className="flex-1 flex flex-col glass">
          <PromptPanel
            onGenerate={generateSingle}
            onGenerateAll={generateAll}
            isGeneratingAll={isGeneratingAll}
            onPromptsChange={(count) => setSavedPromptsCount(count)}
          />
        </div>
      </div>

      {/* ── MOBILE: 2-Tab layout ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative z-10">
        <div
          className="flex-shrink-0 flex border-b"
          style={{ background: "rgba(17,17,24,0.95)", borderColor: "var(--glass-border)" }}
        >
          {mobileTabs.map((tab) => {
            const active = mobileTab === tab.id;
            const selectedImg = images.find((i) => i.id === selectedId);
            const badge =
              tab.id === "images" && images.length > 0
                ? images.length
                : tab.id === "prompt" && selectedImg?.resultDataUrl
                ? "✓"
                : null;

            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-all border-b-2 relative",
                  active
                    ? "text-[#a78bfa] border-[#7c6af7]"
                    : "text-white/30 border-transparent"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
                {badge !== null && (
                  <span className="absolute top-1.5 right-4 text-[9px] bg-[#7c6af7] text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileTab === "images" && (
            <div className="h-full" onClick={handleMobileImageSelect}>
              <ImageList />
            </div>
          )}
          {mobileTab === "prompt" && (
            <PromptPanel
              onGenerate={async (id) => {
                await generateSingle(id);
              }}
              onGenerateAll={generateAll}
              isGeneratingAll={isGeneratingAll}
              onPromptsChange={(count) => setSavedPromptsCount(count)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
