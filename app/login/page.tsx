"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ZapIcon, EyeIcon, EyeOffIcon, LoaderIcon } from "lucide-react";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") ?? "/image-editor";
        router.replace(from);
      } else {
        const { error } = await res.json();
        setError(error ?? "Fehler beim Login");
      }
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-grid"
      style={{ background: "var(--background)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/10 via-transparent to-[#a78bfa]/5" />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #7c6af7, #a78bfa)" }}
          >
            <ZapIcon size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold gradient-text">Insta Builder</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            @denniskral_ · Content Studio
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-6 space-y-4"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <label className="text-xs text-white/40 block mb-2">Passwort</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Zugangspasswort eingeben"
                autoFocus
                className="w-full rounded-xl px-3 py-3 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#7c6af7]/50 pr-10"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {show ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
              boxShadow: "0 0 20px rgba(124,106,247,0.3)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <LoaderIcon size={15} className="animate-spin" />
                Prüfe...
              </span>
            ) : (
              "Einloggen"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
