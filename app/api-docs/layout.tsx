export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--text-primary)" }}
    >
      {/* Minimal top bar */}
      <div
        className="sticky top-0 z-10 border-b px-5 py-3 flex items-center gap-3"
        style={{
          background: "rgba(10,10,15,0.92)",
          backdropFilter: "blur(20px)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#7c6af7,#a78bfa)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-white/80">Insta Builder · API Docs</span>
        <a
          href="/image-editor"
          className="ml-auto text-[11px] text-white/30 hover:text-white/60 transition-colors"
        >
          ← App öffnen
        </a>
      </div>
      {children}
    </div>
  );
}
