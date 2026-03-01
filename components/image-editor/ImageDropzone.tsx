"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloudIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileToBase64 } from "@/lib/utils";
import { useImageEditorStore, type EditorImage } from "@/store/imageEditorStore";
import { nanoid } from "@/lib/nanoid";

export function ImageDropzone() {
  const { images, addImages } = useImageEditorStore();
  const remaining = 20 - images.length;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (remaining <= 0) return;
      const files = acceptedFiles.slice(0, remaining);

      const newImages: EditorImage[] = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          const dataUrl = `data:${file.type};base64,${base64}`;
          return {
            id: nanoid(),
            file,
            originalDataUrl: dataUrl,
            originalBase64: base64,
            mimeType: file.type || "image/jpeg",
            prompt: "",
            status: "idle" as const,
          };
        })
      );

      addImages(newImages);
    },
    [addImages, remaining]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    disabled: remaining <= 0,
    multiple: true,
  });

  if (remaining <= 0) return null;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer transition-all duration-200 active:scale-[0.98] rounded-xl border",
        // Mobile: compact row button
        "flex items-center justify-center gap-2 px-4 py-3",
        // Desktop: taller drop zone with icon + text stacked
        "md:flex-col md:p-4 md:border-dashed md:text-center",
        isDragActive
          ? "border-[#1d4ed8] bg-[#1d4ed8]/10"
          : "border-white/[0.1] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      )}
    >
      <input {...getInputProps()} />
      <UploadCloudIcon size={16} className={cn(isDragActive ? "text-[#60a5fa]" : "text-white/40")} />
      <div>
        <p className="text-[12px] text-white/50 font-medium leading-none">
          {isDragActive ? "Loslassen" : "Aus Galerie"}
        </p>
        <p className="text-[10px] text-white/25 mt-0.5 hidden md:block">
          {remaining} verfügbar · Drag & Drop
        </p>
      </div>
    </div>
  );
}
