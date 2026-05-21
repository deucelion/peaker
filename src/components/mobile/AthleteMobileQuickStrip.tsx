"use client";

import Link from "next/link";
import { Moon, Zap, Calendar, Package, Bell, FileText } from "lucide-react";
import type { AthletePermissions } from "@/lib/types";

export function AthleteMobileQuickStrip({ permissions }: { permissions: AthletePermissions }) {
  const links = [
    permissions.can_view_morning_report
      ? { href: "/sporcu/sabah-raporu", label: "Sabah", icon: Moon }
      : null,
    permissions.can_view_rpe_entry ? { href: "/anket", label: "RPE", icon: Zap } : null,
    permissions.can_view_calendar ? { href: "/takvim", label: "Takvim", icon: Calendar } : null,
    { href: "/ozel-ders-paketlerim", label: "Paket", icon: Package },
    permissions.can_view_notifications ? { href: "/bildirimler", label: "Bildirim", icon: Bell } : null,
    permissions.can_view_programs ? { href: "/programlarim", label: "Program", icon: FileText } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof Moon }>;

  if (links.length === 0) return null;

  return (
    <nav
      aria-label="Sporcu hızlı erişim"
      className="grid gap-1 rounded-xl border border-white/10 bg-[#121215] p-2 sm:hidden"
      style={{ gridTemplateColumns: `repeat(${Math.min(links.length, 4)}, minmax(0, 1fr))` }}
    >
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 touch-manipulation active:bg-[#7c3aed]/10"
        >
          <Icon size={18} className="text-[#7c3aed]" aria-hidden />
          <span className="text-[8px] font-black uppercase text-gray-400">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
