"use client";

import Link from "next/link";
import { ChevronDown, Moon, Zap, Calendar, Package, Bell, FileText, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type { AthletePermissions } from "@/lib/types";

type StripLink = {
  href: string;
  label: string;
  icon: typeof Moon;
  done?: boolean;
};

type AthleteMobileQuickStripProps = {
  permissions: AthletePermissions;
  completion?: {
    morningReportDone?: boolean;
    rpeDoneToday?: boolean;
  };
};

export function AthleteMobileQuickStrip({ permissions, completion }: AthleteMobileQuickStripProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const links = useMemo(() => {
    const items: StripLink[] = [];
    if (permissions.can_view_morning_report) {
      items.push({
        href: "/sporcu/sabah-raporu",
        label: completion?.morningReportDone ? "Sabah ✓" : "Sabah",
        icon: Moon,
        done: completion?.morningReportDone,
      });
    }
    if (permissions.can_view_rpe_entry) {
      items.push({
        href: "/anket",
        label: completion?.rpeDoneToday ? "RPE ✓" : "RPE",
        icon: Zap,
        done: completion?.rpeDoneToday,
      });
    }
    if (permissions.can_view_calendar) items.push({ href: "/takvim", label: "Takvim", icon: Calendar });
    if (permissions.can_view_programs) items.push({ href: "/ozel-ders-paketlerim", label: "Paket", icon: Package });
    if (permissions.can_view_notifications) items.push({ href: "/bildirimler", label: "Bildirim", icon: Bell });
    if (permissions.can_view_programs) items.push({ href: "/programlarim", label: "Program", icon: FileText });
    return items;
  }, [permissions, completion]);

  if (links.length === 0) return null;

  const primary = links.slice(0, 4);
  const overflow = links.slice(4);

  return (
    <div className="space-y-2 sm:hidden">
      <nav
        aria-label="Sporcu hızlı erişim"
        className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-[#121215] p-2"
      >
        {primary.map(({ href, label, icon: Icon, done }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 touch-manipulation active:bg-[#7c3aed]/10 ${
              done ? "border border-emerald-500/20 bg-emerald-500/5" : ""
            }`}
          >
            <Icon size={18} className={done ? "text-emerald-400" : "text-[#7c3aed]"} aria-hidden />
            <span className={`text-[8px] font-black uppercase ${done ? "text-emerald-300" : "text-gray-400"}`}>{label}</span>
          </Link>
        ))}
      </nav>

      {overflow.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            className="flex w-full min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#121215] text-[9px] font-black uppercase text-gray-400"
          >
            <MoreHorizontal size={14} aria-hidden />
            Daha fazla
            <ChevronDown size={14} className={sheetOpen ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
          </button>
          {sheetOpen ? (
            <nav className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#121215] p-2" aria-label="Ek hızlı erişim">
              {overflow.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-2 active:bg-[#7c3aed]/10"
                >
                  <Icon size={16} className="text-[#7c3aed]" aria-hidden />
                  <span className="text-[8px] font-black uppercase text-gray-400">{label}</span>
                </Link>
              ))}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
