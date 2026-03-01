"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SettingsIcon, XIcon, CheckCircleIcon, AlertCircleIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon } from "lucide-react";

const STORAGE_KEY = "ig_session_id";

export function useInstagramSession() {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    setSessionId(localStorage.getItem(STORAGE_KEY) ?? "");
  }, []);

  const save = (id: string) => {
    const trimmed = id.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
    setSessionId(trimmed);
  };

  return { sessionId, save };
}

export function InstagramSettings() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setValue(stored);
    setHasSession(!!stored);
  }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
    setHasSession(!!trimmed);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setValue("");
    setHasSession(false);
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border overflow-hidden"
        style={{
          background: "rgba(17,17,24,0.98)",
          borderColor: "rgba(255,255,255,0.09)",
          boxShadow: "0 0 80px rgba(29,78,216,0.15), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <SettingsIcon size={14} className="text-[#60a5fa]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Instagram Einstellungen</p>
            <p className="text-[10px] text-white/30">Session-Cookie für Bild-Import</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60">
            <XIcon size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            hasSession
              ? "border-[#34d399]/20 bg-[#34d399]/5"
              : "border-[#f87171]/20 bg-[#f87171]/5"
          }`}>
            {hasSession
              ? <CheckCircleIcon size={12} className="text-[#34d399] flex-shrink-0" />
              : <AlertCircleIcon size={12} className="text-[#f87171] flex-shrink-0" />}
            <p className={`text-[11px] ${hasSession ? "text-[#34d399]/80" : "text-[#f87171]/80"}`}>
              {hasSession ? "Instagram-Session aktiv – Import funktioniert" : "Kein Session-Cookie – Import blockiert"}
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <p className="text-[11px] text-white/50 font-medium">So bekommst du deinen Session-Cookie:</p>
            <ol className="space-y-1.5">
              {[
                "Öffne Chrome → instagram.com (eingeloggt)",
                "Drücke F12 → Tab \"Application\"",
                "Links: Cookies → https://www.instagram.com",
                "Suche den Cookie: sessionid",
                "Kopiere den Wert und füge ihn unten ein",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-[#1d4ed8] font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-[10px] text-white/40 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-[#60a5fa]/60 hover:text-[#60a5fa] transition-colors"
            >
              <ExternalLinkIcon size={9} />
              Instagram öffnen
            </a>
          </div>

          {/* Input */}
          <div>
            <p className="text-[10px] text-white/30 mb-2">sessionid Cookie-Wert</p>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Wert hier einfügen..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 pr-10 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-[#1d4ed8]/40 transition-colors font-mono"
              />
              <button
                onClick={() => setShow(!show)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
              >
                {show ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {hasSession && (
              <button
                onClick={handleClear}
                className="px-3 py-2 rounded-xl text-xs border border-white/[0.06] text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                Löschen
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saved}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-white bg-[#1d4ed8]/80 hover:bg-[#1d4ed8] disabled:opacity-60 transition-all"
            >
              {saved ? "✓ Gespeichert" : "Speichern"}
            </button>
          </div>

          <p className="text-[9px] text-white/15 leading-relaxed">
            Der Cookie wird nur in deinem Browser (localStorage) gespeichert und niemals auf dem Server persistiert.
            Er läuft typischerweise nach einigen Wochen ab.
          </p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15 transition-all"
        title="Instagram Einstellungen"
      >
        <SettingsIcon size={12} />
        {/* dot indicator */}
        <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${hasSession ? "bg-[#34d399]" : "bg-[#f87171]"}`} />
      </button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
