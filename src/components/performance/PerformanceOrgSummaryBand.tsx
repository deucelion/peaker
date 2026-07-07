"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ClipboardCheck, Moon, Users } from "lucide-react";
import { listDailyTrainingLoadReports } from "@/lib/actions/managementDirectoryActions";
import { listWellnessArchiveForManagement } from "@/lib/actions/wellnessFormActions";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { hrefWellnessArchive } from "@/lib/navigation/wellnessArchiveLinks";
import { hrefFieldTestSession, todayFieldTestSessionDate } from "@/lib/fieldTests/fieldTestSessionRoutes";
import { isWellnessReportCritical } from "@/lib/wellness/wellnessScore";

type PerformanceOrgSummaryBandProps = {
  athleteCount: number;
  className?: string;
};

export function PerformanceOrgSummaryBand({ athleteCount, className = "" }: PerformanceOrgSummaryBandProps) {
  const [todayRpeCount, setTodayRpeCount] = useState<number | null>(null);
  const [criticalWellness, setCriticalWellness] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [rpeRes, wellnessRes] = await Promise.all([
        listDailyTrainingLoadReports(),
        listWellnessArchiveForManagement({ page: 1, pageSize: 50 }),
      ]);

      if (!("error" in rpeRes)) {
        setTodayRpeCount(rpeRes.reports?.length ?? 0);
      } else {
        setTodayRpeCount(null);
      }

      if (!("error" in wellnessRes)) {
        const today = new Date().toISOString().slice(0, 10);
        const todayReports = wellnessRes.reports.filter(
          (r) => String(r.report_date).slice(0, 10) === today
        );
        setCriticalWellness(todayReports.filter((r) => isWellnessReportCritical(r)).length);
      } else {
        setCriticalWellness(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const missingRpe =
    todayRpeCount !== null && athleteCount > 0 ? Math.max(0, athleteCount - todayRpeCount) : null;
  const todaySessionHref = hrefFieldTestSession(todayFieldTestSessionDate());

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-[#121215]/90 p-4 sm:p-5 ${className}`}
      aria-label="Organizasyon performans özeti"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Bugün · organizasyon özeti</p>
        {loading ? (
          <span className="text-[9px] font-bold uppercase text-gray-600">Yükleniyor…</span>
        ) : (
          <button
            type="button"
            onClick={() => void fetchSummary()}
            className="text-[9px] font-black uppercase tracking-wider text-[#c4b5fd] hover:text-white"
          >
            Yenile
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryChip
          icon={<Users size={14} aria-hidden />}
          label="RPE katılımı"
          value={todayRpeCount !== null ? `${todayRpeCount}/${athleteCount}` : "—"}
          href={PATHS.idmanRaporu}
          tone={missingRpe && missingRpe > 0 ? "amber" : "neutral"}
          hint={missingRpe && missingRpe > 0 ? `${missingRpe} sporcu henüz girmedi` : "Günlük idman raporu"}
        />
        <SummaryChip
          icon={<Moon size={14} aria-hidden />}
          label="Kritik wellness"
          value={criticalWellness !== null ? String(criticalWellness) : "—"}
          href={hrefWellnessArchive()}
          tone={criticalWellness && criticalWellness > 0 ? "red" : "neutral"}
          hint="Wellness arşivi"
        />
        <SummaryChip
          icon={<ClipboardCheck size={14} aria-hidden />}
          label="Saha testi"
          value="Oturum"
          href={todaySessionHref}
          tone="violet"
          hint="Bugünkü oturuma git"
        />
        <SummaryChip
          icon={<AlertTriangle size={14} aria-hidden />}
          label="Eksik RPE"
          value={missingRpe !== null ? String(missingRpe) : "—"}
          href={PATHS.idmanRaporu}
          tone={missingRpe && missingRpe > 0 ? "amber" : "neutral"}
          hint="İdman raporunu aç"
        />
      </div>
    </section>
  );
}

function SummaryChip({
  icon,
  label,
  value,
  href,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
  hint: string;
  tone: "neutral" | "amber" | "red" | "violet";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/30 bg-red-500/10"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/10"
        : tone === "violet"
          ? "border-[#7c3aed]/30 bg-[#7c3aed]/10"
          : "border-white/10 bg-white/[0.03]";

  return (
    <Link
      href={href}
      className={`flex min-h-16 flex-col justify-between rounded-xl border p-3 transition hover:border-[#7c3aed]/40 ${toneClass}`}
    >
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-gray-400">
        {icon}
        {label}
      </div>
      <p className="text-lg font-black tabular-nums text-white">{value}</p>
      <p className="text-[8px] font-bold uppercase tracking-wide text-gray-500">{hint}</p>
    </Link>
  );
}
