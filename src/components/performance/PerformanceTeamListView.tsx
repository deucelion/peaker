"use client";

import Link from "next/link";
import type { AthleteOption } from "@/types/performance";
import { hrefAthleteDetail } from "@/lib/navigation/athleteDetailBackLink";
import { hrefPerformansWithAthlete } from "@/lib/navigation/performanceLinks";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { DataTable, uiTableRowHoverClass, uiTableTdClass, uiTableThClass } from "@/components/ui/data-display";

type DailyReportRow = {
  profile_id?: string | null;
  profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
  rpe_score?: number;
};

type PerformanceTeamListViewProps = {
  athletes: AthleteOption[];
  dailyReports: DailyReportRow[];
  className?: string;
};

function profileIdFromReport(row: DailyReportRow): string | null {
  if (row.profile_id) return row.profile_id;
  return null;
}

export function PerformanceTeamListView({ athletes, dailyReports, className = "" }: PerformanceTeamListViewProps) {
  const reportByProfile = new Map<string, DailyReportRow>();
  for (const row of dailyReports) {
    const id = profileIdFromReport(row);
    if (id) reportByProfile.set(id, row);
  }

  return (
    <section className={`rounded-2xl ui-card p-4 sm:p-5 ${className}`} aria-label="Takım performans listesi">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Takım listesi · bugün</h2>
        <Link href={PATHS.idmanRaporu} className="text-[9px] font-black uppercase tracking-wider ui-kpi-card__trend hover:text-white">
          İdman raporu →
        </Link>
      </div>

      <DataTable
        bare
        scrollClassName=""
        tableClassName="w-full min-w-[640px] text-[11px]"
        headClassName="ui-table-head ui-table-head--divided"
        head={
          <tr>
            <th className={uiTableThClass}>Sporcu</th>
            <th className={uiTableThClass}>Bugün RPE</th>
            <th className={uiTableThClass}>Durum</th>
            <th className={uiTableThClass}>Hızlı geçiş</th>
          </tr>
        }
      >
        {athletes.map((athlete) => {
          const report = reportByProfile.get(athlete.id);
          const rpe = report?.rpe_score;
          const tone =
            rpe === undefined
              ? { label: "Giriş yok", className: "text-amber-300 border-amber-500/30 bg-amber-500/10" }
              : rpe >= 8
                ? { label: "Yüksek RPE", className: "text-red-300 border-red-500/30 bg-red-500/10" }
                : { label: "Tamam", className: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };

          return (
            <tr key={athlete.id} className={uiTableRowHoverClass}>
              <td className={`${uiTableTdClass} font-black text-white`}>{athlete.full_name}</td>
              <td className={`${uiTableTdClass} tabular-nums text-gray-300`}>{rpe ?? "—"}</td>
              <td className={uiTableTdClass}>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${tone.className}`}>
                  {tone.label}
                </span>
              </td>
              <td className={uiTableTdClass}>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={hrefPerformansWithAthlete(athlete.id, "28")}
                    className="text-[9px] font-black uppercase ui-kpi-card__trend hover:text-white"
                  >
                    Yük
                  </Link>
                  <Link
                    href={hrefAthleteDetail(athlete.id, "performans", "performans-analitigi")}
                    className="text-[9px] font-black uppercase text-gray-400 hover:text-white"
                  >
                    Profil
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </section>
  );
}
