"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { DataTable, uiTableRowHoverClass, uiTableTdClass, uiTableThClass } from "@/components/ui/data-display";

export type TeamRow = { id: string; name: string; created_at: string };

export type TeamsListPanelProps = {
  teamsList: TeamRow[];
  teamsLoading: boolean;
  teamAthleteCounts: Record<string, number>;
  newTeamNameInput: string;
  setNewTeamNameInput: (v: string) => void;
  teamCreateBusy: boolean;
  onCreateTeam: () => void;
  onOpenTeamDetail: (teamId: string) => void;
  onBackToAthletes: () => void;
};

export function TeamsListPanel({
  teamsList,
  teamsLoading,
  teamAthleteCounts,
  newTeamNameInput,
  setNewTeamNameInput,
  teamCreateBusy,
  onCreateTeam,
  onOpenTeamDetail,
  onBackToAthletes,
}: TeamsListPanelProps) {
  return (
    <section className="space-y-5 rounded-2xl ui-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-black uppercase tracking-tight text-white">Takım yönetimi</h2>
          <p className="mt-1 max-w-xl text-[11px] font-semibold leading-relaxed text-gray-500">
            Sporcuları takımlara ayırarak filtreleme ve organizasyonu kolaylaştırın.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToAthletes}
          className="ui-btn-ghost shrink-0 self-start rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-300 transition hover:text-white"
        >
          Sporcu yönetimi ekranına dön
        </button>
      </div>

      <div className="rounded-xl ui-card-inner p-4">
        <p className="text-[10px] font-black uppercase text-gray-500">Yeni takım oluştur</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={newTeamNameInput}
            onChange={(e) => setNewTeamNameInput(e.target.value)}
            placeholder="Takım adı"
            maxLength={60}
            className="ui-input min-h-11 w-full flex-1 sm:max-w-md"
          />
          <button
            type="button"
            disabled={teamCreateBusy}
            onClick={() => onCreateTeam()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl ui-btn-primary px-5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,transparent)] transition hover:opacity-90 disabled:opacity-50"
          >
            {teamCreateBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Takım oluştur
          </button>
        </div>
      </div>

      {teamsLoading ? (
        <div className="flex min-h-[20dvh] items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
        </div>
      ) : teamsList.length === 0 ? (
        <div className="rounded-xl border border-dashed ui-card-inner px-4 py-10 text-center">
          <p className="text-sm font-black text-gray-200">Henüz takım oluşturulmadı.</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-500">İlk takımı oluşturarak başlayın.</p>
        </div>
      ) : (
        <DataTable
          className="rounded-xl"
          scrollClassName=""
          tableClassName="min-w-full text-left text-sm"
          headClassName="ui-table-head ui-table-head--divided text-[10px] font-black uppercase"
          head={
            <tr>
              <th className={`${uiTableThClass} px-4 py-3`}>Takım adı</th>
              <th className={`${uiTableThClass} px-4 py-3 text-right`}>Sporcu sayısı</th>
              <th className={`${uiTableThClass} px-4 py-3`}>Oluşturulma</th>
              <th className={`${uiTableThClass} w-24 px-4 py-3 text-right`}> </th>
            </tr>
          }
        >
          {teamsList.map((t) => {
            const athleteCount = teamAthleteCounts[t.name] ?? 0;
            const createdLabel = t.created_at
              ? new Date(t.created_at).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "—";
            return (
              <tr
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenTeamDetail(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenTeamDetail(t.id);
                  }
                }}
                className={`${uiTableRowHoverClass} cursor-pointer text-xs text-gray-200 focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)]`}
              >
                <td className={`${uiTableTdClass} px-4 py-3 font-semibold text-white`}>{t.name}</td>
                <td className={`${uiTableTdClass} px-4 py-3 text-right tabular-nums`}>{athleteCount}</td>
                <td className={`${uiTableTdClass} px-4 py-3 text-gray-400`}>{createdLabel}</td>
                <td className={`${uiTableTdClass} px-4 py-3 text-right text-[color:var(--peaker-ui-PRIMARY)]`}>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                    Detay
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </section>
  );
}
