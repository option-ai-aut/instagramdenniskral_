"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ImageIcon, LayoutIcon, ClockIcon, LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/image-editor", icon: ImageIcon, label: "Editor" },
  { href: "/canvas", icon: LayoutIcon, label: "Canvas" },
  { href: "/history", icon: ClockIcon, label: "History" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: "rgba(10,10,15,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all"
            >
              <item.icon
                size={20}
                className={cn(
                  "transition-colors",
                  active ? "text-[#a78bfa]" : "text-white/30"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  active ? "text-[#a78bfa]" : "text-white/30"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl"
        >
          <LogOutIcon size={20} className="text-white/20" />
          <span className="text-[10px] font-medium text-white/20">Logout</span>
        </button>
      </div>
    </nav>
  );
}
