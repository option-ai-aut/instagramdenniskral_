"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ImageIcon, LayoutIcon, ClockIcon, ZapIcon, LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/image-editor",
    icon: ImageIcon,
    label: "Image Editor",
    description: "KI-Bildbearbeitung",
  },
  {
    href: "/canvas",
    icon: LayoutIcon,
    label: "Canvas",
    description: "Karussell-Editor",
  },
  {
    href: "/history",
    icon: ClockIcon,
    label: "History",
    description: "Alle Erstellungen",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col h-full glass border-r"
      style={{ borderColor: "var(--glass-border)" }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c6af7, #a78bfa)" }}
          >
            <ZapIcon size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold gradient-text">Insta Builder</p>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              @denniskral_
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                active
                  ? "bg-[#7c6af7]/15 border border-[#7c6af7]/20"
                  : "hover:bg-white/[0.04] border border-transparent"
              )}
            >
              <item.icon
                size={16}
                className={cn(
                  "flex-shrink-0 transition-colors",
                  active ? "text-[#a78bfa]" : "text-white/30 group-hover:text-white/60"
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[13px] font-medium leading-none mb-0.5",
                    active ? "text-white" : "text-white/60 group-hover:text-white/80"
                  )}
                >
                  {item.label}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div
        className="px-4 py-4 border-t"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <LogOutIcon size={13} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
