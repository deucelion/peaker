"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, Calendar, ClipboardCheck, Clock, FileText, CheckCircle2, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { listDailyTrainingLoadReports } from "@/lib/actions/managementDirectoryActions";
import { listWellnessArchiveForManagement } from "@/lib/actions/wellnessFormActions";
import { isWellnessReportCritical } from "@/lib/wellness/wellnessScore";
import { PATHS } from "@/lib/navigation/routeRegistry";

const BASE_LINKS = [
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
  { href: PATHS.performans, label: "Performans", icon: Activity, badgeKey: "perf" as const },
] as const;

export function CoachMobileQuickStrip() {
  const online = useOnlineStatus();
  const [perfBadge, setPerfBadge] = useState<number | null>(null);

  const fetchBadge = useCallback(async () => {
    try {
      const [rpeRes, wellnessRes] = await Promise.all([
        listDailyTrainingLoadReports(),
        listWellnessArchiveForManagement({ page: 1, pageSize: 50 }),
      ]);
      let count = 0;
      if (!("error" in wellnessRes)) {
        const today = new Date().toISOString().slice(0, 10);
        count += wellnessRes.reports.filter(
          (r) => String(r.report_date).slice(0, 10) === today && isWellnessReportCritical(r)
        ).length;
      }
      if (!("error" in rpeRes)) {
        count += rpeRes.reports.filter((r) => r.rpe_score >= 8).length;
      }
      setPerfBadge(count > 0 ? count : null);
    } catch {
      setPerfBadge(null);
    }
  }, []);

  useEffect(() => {
    void fetchBadge();
  }, [fetchBadge]);

  return (
    <div className="space-y-1.5 lg:hidden">
      {!online ? (
        <p className="flex items-center justify-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[9px] font-bold uppercase text-amber-200">
          <WifiOff size={12} aria-hidden /> Çevrimdışı — güvenli işlemler kuyrukta
        </p>
      ) : null}
      <nav aria-label="Koç hızlı işlemler" className="ui-card grid grid-cols-5 gap-0.5 p-1.5">
        {BASE_LINKS.map(({ href, label, icon: Icon, ...rest }) => {
          const showBadge = "badgeKey" in rest && rest.badgeKey === "perf" && perfBadge !== null;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent px-0.5 py-1.5 text-center touch-manipulation active:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] active:bg-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)]"
            >
              <Icon size={16} className="text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
              <span className="text-[7px] font-black uppercase leading-tight tracking-wide text-gray-400">
                {label}
              </span>
              {showBadge ? (
                <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white">
                  {perfBadge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {perfBadge !== null ? (
        <p className="flex items-center justify-center gap-1 text-[8px] font-bold uppercase text-gray-500">
          <Clock size={10} aria-hidden />
          Performans uyarıları: {perfBadge}
        </p>
      ) : null}
    </div>
  );
}
