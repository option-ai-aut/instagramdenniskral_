"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DownloadIcon, ImageIcon, LayoutIcon, RefreshCwIcon, LoaderIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ImageItemDB = {
  id: string;
  originalUrl: string;
  resultUrl?: string;
  prompt?: string;
  status: string;
  createdAt: string;
};

type SessionDB = {
  id: string;
  name: string;
  updatedAt: string;
  images: ImageItemDB[];
};

type CarouselDB = {
  id: string;
  title: string;
  thumbUrl?: string;
  createdAt: string;
  slidesJson: unknown;
};

type Filter = "all" | "images" | "carousels";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionDB[]>([]);
  const [carousels, setCarousels] = useState<CarouselDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then(({ sessions, carousels }) => {
        setSessions(sessions ?? []);
        setCarousels(carousels ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const allImages = sessions.flatMap((s) =>
    s.images.filter((img) => img.resultUrl).map((img) => ({ ...img, sessionName: s.name }))
  );

  return (
    <div className="flex flex-col h-full bg-grid overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div
        className="px-4 sm:px-6 py-4 border-b glass flex flex-col sm:flex-row sm:items-center gap-3 relative z-10 flex-shrink-0"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold gradient-text">History</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {allImages.length} Bilder · {carousels.length} Karussells
          </p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {(["all", "images", "carousels"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap",
                filter === f
                  ? "border-[#7c6af7]/40 bg-[#7c6af7]/10 text-[#a78bfa]"
                  : "border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/60"
              )}
            >
              {f === "all" ? "Alle" : f === "images" ? "Bilder" : "Karussells"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoaderIcon size={20} className="text-white/20 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Images */}
            {(filter === "all" || filter === "images") && (
              <div>
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <ImageIcon size={14} className="text-[#7c6af7]" />
                  <h2 className="text-sm font-medium text-white/70">
                    KI-Bilder <span className="text-white/30">({allImages.length})</span>
                  </h2>
                </div>

                {allImages.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-sm text-white/20">Noch keine Bilder generiert</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                    {allImages.map((img) => (
                      <ImageHistoryCard key={img.id} img={img} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Carousels */}
            {(filter === "all" || filter === "carousels") && (
              <div>
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <LayoutIcon size={14} className="text-[#7c6af7]" />
                  <h2 className="text-sm font-medium text-white/70">
                    Karussells <span className="text-white/30">({carousels.length})</span>
                  </h2>
                </div>

                {carousels.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-sm text-white/20">Noch keine Karussells erstellt</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {carousels.map((carousel) => (
                      <CarouselHistoryCard key={carousel.id} carousel={carousel} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageHistoryCard({ img }: { img: ImageItemDB & { sessionName: string } }) {
  return (
    <div className="group relative rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] active:scale-[0.97] transition-all">
      <div className="aspect-square relative">
        <Image
          src={img.resultUrl!}
          alt="Generated image"
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 200px"
        />
        {/* Mobile: always show actions, desktop: show on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
          <p className="text-[10px] text-white/70 mb-1.5 line-clamp-2">{img.prompt ?? ""}</p>
          <div className="flex gap-1">
            <a
              href={img.resultUrl}
              download
              className="flex-1 flex items-center justify-center py-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <DownloadIcon size={12} />
            </a>
            <a
              href={img.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center py-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <RefreshCwIcon size={12} />
            </a>
          </div>
        </div>
      </div>

      <div className="px-2 py-1.5" style={{ background: "rgba(17,17,24,0.9)" }}>
        <p className="text-[9px] text-white/30">{formatDate(img.createdAt)}</p>
      </div>
    </div>
  );
}

function CarouselHistoryCard({ carousel }: { carousel: CarouselDB }) {
  const slides = Array.isArray(carousel.slidesJson) ? carousel.slidesJson : [];

  return (
    <div className="group relative rounded-xl overflow-hidden border border-white/[0.06] hover:border-[#7c6af7]/30 active:scale-[0.97] transition-all cursor-pointer">
      <div
        className="aspect-[4/5] flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #111118, #1a1a24)" }}
      >
        <div className="text-center px-4">
          <LayoutIcon size={20} className="text-[#7c6af7]/40 mx-auto mb-2" />
          <p className="text-xs text-white/40">{slides.length} Slides</p>
        </div>
      </div>

      <div className="px-2 py-2" style={{ background: "rgba(17,17,24,0.95)" }}>
        <p className="text-[11px] font-medium text-white/70 truncate">{carousel.title}</p>
        <p className="text-[9px] text-white/25 mt-0.5">{formatDate(carousel.createdAt)}</p>
      </div>
    </div>
  );
}
