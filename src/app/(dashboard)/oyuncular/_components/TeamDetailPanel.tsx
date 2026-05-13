"use client";

import { ChevronRight, Loader2 } from "lucide-react";

export type TeamDetailAthleteRow = {
  id: string;
  fullName: string;
  email: string;
  number: string;
  position: string;
  isActive: boolean;
};

export type TeamDetailAvailableRow = { id: string; fullName: string };

export type TeamDetailWorkspace = {
  team: { id: string; name: string };
  athletes: TeamDetailAthleteRow[];
  availableAthletes: TeamDetailAvailableRow[];
  canManageTeamMembers: boolean;
  summary: {
    total: number;
    activeCount: number;
    inactiveCount: number;
    positionSummary: Record<string, number>;
  };
};

export type TeamDetailPanelProps = {
  teamDetail: TeamDetailWorkspace | null;
  teamDetailLoading: boolean;
  athleteToAddId: string;
  setAthleteToAddId: (v: string) => void;
  assignBusy: boolean;
  removeBusyId: string | null;
  onAssignAthlete: () => void;
  onRemoveAthlete: (athleteId: string, athleteName: string) => void;
  onBackToTeams: () => void;
};

export function TeamDetailPanel({
  teamDetail,
  teamDetailLoading,
  athleteToAddId,
  setAthleteToAddId,
  assignBusy,
  removeBusyId,
  onAssignAthlete,
  onRemoveAthlete,
  onBackToTeams,
}: TeamDetailPanelProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBackToTeams}
            className="mb-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:border-white/20 hover:text-white"
          >
            <ChevronRight className="size-3.5 rotate-180" aria-hidden />
            Takımlara dön
          </button>
          {teamDetailLoading && !teamDetail ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="size-5 animate-spin text-[#7c3aed]" aria-hidden />
              <span className="text-[11px] font-semibold text-gray-500">Yükleniyor…</span>
            </div>
          ) : teamDetail ? (
            <>
              <h2 className="text-lg font-black uppercase tracking-tight text-white">{teamDetail.team.name}</h2>
              <p className="mt-1 text-[11px] font-semibold text-gray-500">
                Takımdaki sporcu:{" "}
                <span className="tabular-nums text-gray-300">{teamDetail.summary.total}</span>
                {teamDetailLoading ? (
                  <span className="ml-2 inline-flex align-middle">
                    <Loader2 className="size-3.5 animate-spin text-[#7c3aed]" aria-hidden />
                  </span>
                ) : null}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {!teamDetailLoading && teamDetail && !teamDetail.canManageTeamMembers ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100/90">
          Takım üyelerini düzenleme yetkiniz yok. Liste salt okunurdur.
        </p>
      ) : null}

      {teamDetail && teamDetail.canManageTeamMembers ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-black uppercase text-gray-500">Sporcu ekle</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={athleteToAddId}
              onChange={(e) => setAthleteToAddId(e.target.value)}
              disabled={assignBusy || teamDetailLoading}
              className="ui-select min-h-11 w-full flex-1 sm:max-w-md"
            >
              <option value="">
                {teamDetail.availableAthletes.length === 0
                  ? "Eklenebilecek sporcu yok"
                  : "Sporcu seçin"}
              </option>
              {teamDetail.availableAthletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={assignBusy || !athleteToAddId || teamDetailLoading}
              onClick={() => onAssignAthlete()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed] px-5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-[#7c3aed]/25 transition hover:bg-[#6d28d9] disabled:opacity-45"
            >
              {assignBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Takıma ekle
            </button>
          </div>
        </div>
      ) : null}

      {teamDetail && !teamDetailLoading ? (
        teamDetail.athletes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/15 px-4 py-10 text-center">
            <p className="text-sm font-black text-gray-200">Bu takımda henüz sporcu yok.</p>
            <p className="mt-1 text-[11px] font-semibold text-gray-500">Yukarıdan sporcu ekleyerek başlayın.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-[10px] font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Ad soyad</th>
                  <th className="px-4 py-3">E-posta</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {teamDetail.athletes.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 text-xs text-gray-200">
                    <td className="px-4 py-3 font-semibold text-white">{a.fullName}</td>
                    <td className="max-w-[12rem] truncate px-4 py-3 text-gray-400">{a.email}</td>
                    <td className="px-4 py-3 text-gray-400">{a.position}</td>
                    <td className="px-4 py-3 text-right">
                      {teamDetail.canManageTeamMembers ? (
                        <button
                          type="button"
                          disabled={removeBusyId === a.id || assignBusy}
                          onClick={() => onRemoveAthlete(a.id, a.fullName)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-200 transition hover:bg-red-500/20 disabled:opacity-45"
                        >
                          {removeBusyId === a.id ? (
                            <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden />
                          ) : (
                            "Takımdan çıkar"
                          )}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
