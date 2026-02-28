"use client";

import { useEffect, useRef, useState } from "react";
import { ImageList } from "@/components/image-editor/ImageList";
import { PromptPanel } from "@/components/image-editor/PromptPanel";
import { useImageEditorStore } from "@/store/imageEditorStore";
import { base64ToDataUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ImageIcon, SparklesIcon } from "lucide-react";

type MobileTab = "images" | "prompt";

const mobileTabs: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: "images", label: "Bilder", icon: ImageIcon },
  { id: "prompt", label: "Prompt & Ergebnis", icon: SparklesIcon },
];

export default function ImageEditorPage() {
  const { images, sessionId, setSessionId, updateImage, selectedId } = useImageEditorStore();
  const [mobileTab, setMobileTab] = useState<MobileTab>("images");
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

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
  }, [setSessionId]);

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

      // Auto-switch to prompt tab on mobile when done
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

  const isGeneratingAll = images.some((img) => img.status === "processing");

  const handleMobileImageSelect = () => {
    setMobileTab("prompt");
  };

  return (
    <div className="flex flex-col h-full bg-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/[0.03] via-transparent to-transparent pointer-events-none" />

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
          />
        </div>
      </div>

      {/* ── MOBILE: 2-Tab layout ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative z-10">
        {/* Tab bar */}
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

        {/* Tab content */}
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
