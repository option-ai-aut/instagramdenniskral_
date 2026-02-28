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
        "border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-center",
        isDragActive
          ? "border-[#7c6af7] bg-[#7c6af7]/10"
          : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
      )}
    >
      <input {...getInputProps()} />
      <UploadCloudIcon size={20} className={cn(isDragActive ? "text-[#a78bfa]" : "text-white/20")} />
      <p className="text-[11px] text-white/30 leading-relaxed">
        {isDragActive ? "Loslassen zum Hinzufügen" : `Bilder hinzufügen (${remaining} verfügbar)`}
      </p>
    </div>
  );
}
