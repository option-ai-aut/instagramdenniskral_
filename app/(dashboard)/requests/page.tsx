"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DownloadIcon, RefreshCwIcon, LoaderIcon, ZapIcon, ChevronDownIcon, ChevronUpIcon,
  FileArchiveIcon, LayoutTemplateIcon, CalendarIcon, LayersIcon, CodeIcon,
  KeyIcon, CopyIcon, CheckIcon, EyeIcon, EyeOffIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RequestBody = {
  tag?: string | null;
  body?: string | null;
  slides?: Array<{ header?: string; subtitle?: string }> | null;
  textOverrides?: Array<{ slideIndex: number; elementType: string; text: string }> | null;
  grainIntensity?: number;
};

type OpenlawRequest = {
  id: string;
  templateId: string;
  templateTitle: string | null;
  title: string | null;
  slideCount: number;
  requestBody: RequestBody | null;
  userId: string;
  createdAt: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `vor ${days}d`;
}

function RequestCard({ req }: { req: OpenlawRequest }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/requests/${req.id}/zip`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Fehler: " + (err.error ?? res.statusText));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${req.title ?? "carousel"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download fehlgeschlagen: " + (e instanceof Error ? e.message : "Unbekannter Fehler"));
    } finally {
      setDownloading(false);
    }
  };

  const body = req.requestBody;
  const hasNewFormat = body && (body.tag !== null && body.tag !== undefined || body.body !== null && body.body !== undefined || body.slides);
  const hasLegacy = body?.textOverrides && body.textOverrides.length > 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all duration-200"
      style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1d4ed8/20, #60a5fa/10)", border: "1px solid rgba(29,78,216,0.2)" }}
        >
          <FileArchiveIcon size={15} className="text-[#60a5fa]" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-white/90 truncate">
              {req.title ?? "carousel"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/15 text-[#60a5fa]/80 border border-[#1d4ed8]/20 flex-shrink-0">
              {req.slideCount} Slides
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-white/35 flex items-center gap-1">
              <LayoutTemplateIcon size={10} />
              {req.templateTitle ?? req.templateId.slice(0, 12) + "…"}
            </span>
            <span className="text-[11px] text-white/25 flex items-center gap-1" title={formatDate(req.createdAt)}>
              <CalendarIcon size={10} />
              {timeAgo(req.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all border",
              downloading
                ? "border-white/10 text-white/25 cursor-not-allowed"
                : "border-[#1d4ed8]/30 text-[#60a5fa] hover:bg-[#1d4ed8]/10 active:scale-[0.97]"
            )}
          >
            {downloading
              ? <LoaderIcon size={12} className="animate-spin" />
              : <DownloadIcon size={12} />
            }
            <span className="hidden sm:inline">ZIP</span>
          </button>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.06]"
          >
            {expanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && body && (
        <div
          className="px-4 pb-4 pt-1 border-t space-y-3"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {/* Tag + Body row */}
          {(body.tag || body.body) && (
            <div className="flex flex-wrap gap-2">
              {body.tag && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(29,78,216,0.08)", border: "1px solid rgba(29,78,216,0.15)" }}>
                  <span className="text-[9px] font-bold text-[#60a5fa]/60 uppercase tracking-wider">tag</span>
                  <span className="text-[11px] text-white/70">{body.tag}</span>
                </div>
              )}
              {body.body && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">body</span>
                  <span className="text-[11px] text-white/60">{body.body}</span>
                </div>
              )}
            </div>
          )}

          {/* Per-slide content (new format) */}
          {hasNewFormat && body.slides && body.slides.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider flex items-center gap-1">
                <LayersIcon size={9} /> Slides
              </p>
              <div className="space-y-1">
                {body.slides.map((sl, i) => (
                  (sl.header || sl.subtitle) ? (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-[9px] text-white/25 mt-1 w-5 flex-shrink-0 text-right">{i + 1}</span>
                      <div className="flex-1 rounded-lg px-2.5 py-1.5 space-y-0.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        {sl.header && <p className="text-[11px] text-white/70 font-medium">{sl.header}</p>}
                        {sl.subtitle && <p className="text-[10px] text-white/40">{sl.subtitle}</p>}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}

          {/* Legacy textOverrides */}
          {hasLegacy && body.textOverrides && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider flex items-center gap-1">
                <CodeIcon size={9} /> Text Overrides (Legacy)
              </p>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {body.textOverrides.map((o, i) => (
                  <div key={i} className="flex gap-3 items-start px-3 py-1.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <span className="text-[9px] text-white/25 mt-0.5 w-12 flex-shrink-0">
                      Slide {o.slideIndex + 1} · {o.elementType}
                    </span>
                    <span className="text-[11px] text-white/60 break-all">{o.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grain */}
          {typeof body.grainIntensity === "number" && body.grainIntensity > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-white/25 uppercase tracking-wider">Grain</span>
              <span className="text-[10px] text-white/40">{body.grainIntensity}%</span>
            </div>
          )}

          {/* Template ID */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Template ID</span>
            <code className="text-[10px] text-white/30 font-mono">{req.templateId}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiKeyPanel() {
  const [key, setKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/key")
      .then((r) => r.json())
      .then((d) => setKey(d.key ?? ""))
      .catch(() => setKey(""));
  }, []);

  const handleCopy = async () => {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = key
    ? key.slice(0, 8) + "•".repeat(Math.max(0, key.length - 12)) + key.slice(-4)
    : "…";

  return (
    <div
      className="rounded-2xl border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: "rgba(29,78,216,0.04)", borderColor: "rgba(29,78,216,0.15)" }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(29,78,216,0.12)", border: "1px solid rgba(29,78,216,0.2)" }}
        >
          <KeyIcon size={13} className="text-[#60a5fa]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-white/40 mb-0.5">Openclaw API Key</p>
          <code className="text-[12px] font-mono text-white/70 truncate block">
            {key === null ? "…" : (visible ? key : maskedKey)}
          </code>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setVisible((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] text-white/40 hover:text-white/70 border border-white/[0.07] hover:border-white/[0.14] transition-all"
        >
          {visible ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
          {visible ? "Verbergen" : "Anzeigen"}
        </button>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all border",
            copied
              ? "border-emerald-500/30 text-emerald-400"
              : "border-[#1d4ed8]/25 text-[#60a5fa] hover:bg-[#1d4ed8]/10"
          )}
        >
          {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
          {copied ? "Kopiert!" : "Kopieren"}
        </button>
      </div>
    </div>
  );
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<OpenlawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchRequests = useCallback(async (page = 1) => {
    try {
      const res = await fetch(`/api/requests?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
        setPagination(data.pagination ?? { page, limit: 20, total: 0 });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests(pagination.page);
  };

  return (
    <div className="flex flex-col h-full bg-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1d4ed8]/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div
        className="relative z-10 flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b"
        style={{ background: "rgba(17,17,24,0.8)", borderColor: "var(--glass-border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #60a5fa)" }}
          >
            <ZapIcon size={12} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90">Openclaw Requests</h1>
            {pagination.total > 0 && (
              <p className="text-[10px] text-white/35">{pagination.total} Requests gesamt</p>
            )}
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] text-white/50 hover:text-white/80 border border-white/[0.08] hover:border-white/[0.15] transition-all"
        >
          <RefreshCwIcon size={11} className={cn(refreshing && "animate-spin")} />
          Aktualisieren
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
        {/* API Key section */}
        <div className="max-w-2xl mx-auto mb-4">
          <ApiKeyPanel />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-white/30">
            <LoaderIcon size={16} className="animate-spin" />
            <span className="text-sm">Lade Requests…</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-center px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(29,78,216,0.08)", border: "1px solid rgba(29,78,216,0.15)" }}
            >
              <FileArchiveIcon size={22} className="text-[#60a5fa]/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60 mb-1">Noch keine Requests</p>
              <p className="text-[12px] text-white/30 max-w-xs">
                Sobald Openclaw Karussells generiert, erscheinen sie hier.
                Jeder Request wird mit allen Parametern gespeichert.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {requests.map((req) => (
              <RequestCard key={req.id} req={req} />
            ))}

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="flex items-center justify-center gap-3 pt-2 pb-4">
                <button
                  onClick={() => fetchRequests(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 rounded-xl text-[11px] text-white/40 border border-white/[0.06] disabled:opacity-30 hover:bg-white/[0.04] transition-all"
                >
                  ← Vorherige
                </button>
                <span className="text-[11px] text-white/30">
                  Seite {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <button
                  onClick={() => fetchRequests(pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                  className="px-3 py-1.5 rounded-xl text-[11px] text-white/40 border border-white/[0.06] disabled:opacity-30 hover:bg-white/[0.04] transition-all"
                >
                  Nächste →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
