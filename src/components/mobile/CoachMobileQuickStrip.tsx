"use client";

import Link from "next/link";
import { Calendar, ClipboardCheck, CheckCircle2, FileText, Activity, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

const LINKS = [
  {
    href: "/antrenman-yonetimi?modul=haftalik-takvim&view=takvim",
    label: "Bugün",
    icon: Calendar,
  },
  {
    href: "/antrenman-yonetimi?modul=grup-dersleri&view=yoklama",
    label: "Yoklama",
    icon: ClipboardCheck,
  },
  {
    href: "/haftalik-ders-programi",
    label: "Özel ders",
    icon: CheckCircle2,
  },
  {
    href: "/antrenman-yonetimi?modul=notlar",
    label: "Not",
    icon: FileText,
  },
  { href: "/performans", label: "Performans", icon: Activity },
] as const;

export function CoachMobileQuickStrip() {
  const online = useOnlineStatus();

  return (
    <div className="space-y-1.5 lg:hidden">
      {!online ? (
        <p className="flex items-center justify-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[9px] font-bold uppercase text-amber-200">
          <WifiOff size={12} aria-hidden /> Çevrimdışı — güvenli işlemler kuyrukta
        </p>
      ) : null}
      <nav
        aria-label="Koç hızlı işlemler"
        className="grid grid-cols-5 gap-0.5 rounded-xl border border-white/10 bg-[#121215] p-1.5"
      >
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent px-0.5 py-1.5 text-center touch-manipulation active:border-[#7c3aed]/30 active:bg-[#7c3aed]/10"
          >
            <Icon size={16} className="text-[#7c3aed]" aria-hidden />
            <span className="text-[7px] font-black uppercase leading-tight tracking-wide text-gray-400">
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
