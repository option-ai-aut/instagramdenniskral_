"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { ImageList } from "@/components/image-editor/ImageList";
import { PromptPanel } from "@/components/image-editor/PromptPanel";
import { ResultPanel } from "@/components/image-editor/ResultPanel";
import { useImageEditorStore } from "@/store/imageEditorStore";
import { base64ToDataUrl } from "@/lib/utils";

export default function ImageEditorPage() {
  const { userId } = useAuth();
  const { images, sessionId, setSessionId, updateImage } = useImageEditorStore();
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current || !userId) return;
    initDone.current = true;

    fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Session " + new Date().toLocaleDateString("de-DE") }) })
      .then((r) => r.json())
      .then(({ session }) => {
        if (session?.id) setSessionId(session.id);
      })
      .catch(console.error);
  }, [userId, setSessionId]);

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

      updateImage(imageId, {
        status: "done",
        resultDataUrl,
        resultBase64,
        resultMimeType: mimeType,
      });
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

  return (
    <div className="flex h-full bg-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Left – Image List */}
      <div
        className="w-[200px] flex-shrink-0 flex flex-col border-r glass relative z-10"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <ImageList />
      </div>

      {/* Middle – Prompt */}
      <div
        className="flex-1 flex flex-col border-r glass relative z-10"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <PromptPanel
          onGenerate={generateSingle}
          onGenerateAll={generateAll}
          isGeneratingAll={isGeneratingAll}
        />
      </div>

      {/* Right – Result */}
      <div className="w-[320px] flex-shrink-0 flex flex-col glass relative z-10">
        <ResultPanel />
      </div>
    </div>
  );
}
