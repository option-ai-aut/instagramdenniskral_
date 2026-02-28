"use client";

import Image from "next/image";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImageEditorStore, type EditorImage } from "@/store/imageEditorStore";
import { ImageDropzone } from "./ImageDropzone";

const statusLabels: Record<string, string> = {
  idle: "Bereit",
  processing: "Lädt...",
  done: "Fertig",
  error: "Fehler",
};

function StatusBadge({ status }: { status: EditorImage["status"] }) {
  return (
    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", `status-${status}`)}>
      {statusLabels[status]}
    </span>
  );
}

export function ImageList() {
  const { images, selectedId, selectImage, removeImage } = useImageEditorStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--glass-border)" }}>
        <p className="text-xs font-medium text-white/60">
          Bilder <span className="text-white/30">{images.length}/20</span>
        </p>
      </div>

      {/* Desktop: vertical scroll list */}
      <div className="hidden md:flex flex-1 overflow-y-auto px-3 py-3 flex-col space-y-2">
        {images.map((img, index) => (
          <DesktopImageCard
            key={img.id}
            img={img}
            index={index}
            selected={selectedId === img.id}
            onSelect={() => selectImage(img.id)}
            onRemove={() => removeImage(img.id)}
          />
        ))}
        <ImageDropzone />
      </div>

      {/* Mobile: horizontal scroll + grid */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Upload button at top */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <ImageDropzone />
        </div>

        {images.length > 0 && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, index) => (
                <MobileImageCard
                  key={img.id}
                  img={img}
                  index={index}
                  selected={selectedId === img.id}
                  onSelect={() => selectImage(img.id)}
                  onRemove={() => removeImage(img.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopImageCard({ img, index, selected, onSelect, onRemove }: {
  img: EditorImage; index: number; selected: boolean;
  onSelect: () => void; onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border",
        selected
          ? "border-[#7c6af7]/50 ring-1 ring-[#7c6af7]/30"
          : "border-white/[0.06] hover:border-white/[0.12]"
      )}
    >
      <div className="aspect-square relative">
        <Image src={img.originalDataUrl} alt={`Image ${index + 1}`} fill className="object-cover" sizes="200px" unoptimized />
        {img.status === "processing" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {img.status === "done" && img.resultDataUrl && (
          <div className="absolute bottom-0 left-0 right-0 h-1/3">
            <Image src={img.resultDataUrl} alt="Result" fill className="object-cover opacity-60" sizes="200px" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
        >
          <XIcon size={10} className="text-white" />
        </button>
      </div>
      <div className="px-2 py-1.5 flex items-center justify-between" style={{ background: "rgba(17,17,24,0.9)" }}>
        <span className="text-[10px] text-white/40 truncate">
          {img.prompt ? `"${img.prompt.slice(0, 16)}..."` : `Bild ${index + 1}`}
        </span>
        <StatusBadge status={img.status} />
      </div>
    </div>
  );
}

function MobileImageCard({ img, index, selected, onSelect, onRemove }: {
  img: EditorImage; index: number; selected: boolean;
  onSelect: () => void; onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border active:scale-[0.96]",
        selected
          ? "border-[#7c6af7]/60 ring-2 ring-[#7c6af7]/30"
          : "border-white/[0.08]"
      )}
    >
      <div className="aspect-square relative">
        <Image src={img.originalDataUrl} alt={`Image ${index + 1}`} fill className="object-cover" sizes="120px" unoptimized />

        {img.status === "processing" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {img.status === "done" && (
          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#34d399]/80 flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">✓</span>
          </div>
        )}

        {img.status === "error" && (
          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">!</span>
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 border border-white/10 flex items-center justify-center"
        >
          <XIcon size={9} className="text-white/60" />
        </button>
      </div>
    </div>
  );
}
