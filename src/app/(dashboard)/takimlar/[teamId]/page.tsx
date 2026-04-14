"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, Users } from "lucide-react";
import Notification from "@/components/Notification";
import { loadTeamDetail } from "@/lib/actions/teamActions";

type TeamAthlete = {
  id: string;
  fullName: string;
  number: string;
  position: string;
  isActive: boolean;
};

type TeamDetail = {
  team: { id: string; name: string };
  athletes: TeamAthlete[];
  summary: {
    total: number;
    activeCount: number;
    inactiveCount: number;
    positionSummary: Record<string, number>;
  };
};

export default function TeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);

  useEffect(() => {
    async function run() {
      if (!teamId) {
        setError("Takim kimligi bulunamadi.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await loadTeamDetail(teamId);
      if ("error" in res) {
        setError(res.error ?? "Takim detayi yuklenemedi.");
        setDetail(null);
      } else {
        setDetail(res as TeamDetail);
      }
      setLoading(false);
    }
    void run();
  }, [teamId]);

  const positionRows = useMemo(() => {
    const map = detail?.summary.positionSummary || {};
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  if (loading) {
    return (
      <div className="flex min-h-[40dvh] min-w-0 flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-[#7c3aed]" size={38} aria-hidden />
        <p className="text-[10px] font-black uppercase italic tracking-widest text-gray-500">Takim detayi yukleniyor...</p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <Link
        href="/takimlar"
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-gray-300 sm:hover:border-[#7c3aed]/40"
      >
        <ChevronLeft size={14} aria-hidden /> Takimlar
      </Link>

      {error ? (
        <Notification message={error} variant="error" />
      ) : detail ? (
        <>
          <header className="min-w-0 border-b border-white/5 pb-6">
            <h1 className="ui-h1 break-words">
              {detail.team.name} <span className="text-[#7c3aed]">DETAYI</span>
            </h1>
            <p className="ui-lead">Takimdaki sporcular ve dagilim ozeti.</p>
          </header>

          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-white/5 bg-[#121215] p-4 text-center">
              <p className="text-[9px] font-black uppercase text-gray-500">Toplam Sporcu</p>
              <p className="mt-2 text-2xl font-black italic text-white">{detail.summary.total}</p>
            </div>
            <div className="rounded-[1.25rem] border border-emerald-500/20 bg-[#121215] p-4 text-center">
              <p className="text-[9px] font-black uppercase text-gray-500">Aktif</p>
              <p className="mt-2 text-2xl font-black italic text-emerald-400">{detail.summary.activeCount}</p>
            </div>
            <div className="rounded-[1.25rem] border border-amber-500/20 bg-[#121215] p-4 text-center">
              <p className="text-[9px] font-black uppercase text-gray-500">Pasif</p>
              <p className="mt-2 text-2xl font-black italic text-amber-400">{detail.summary.inactiveCount}</p>
            </div>
          </section>

          <section className="mt-6 rounded-[1.5rem] border border-white/5 bg-[#121215] p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pozisyon Dagilimi</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {positionRows.length === 0 ? (
                <span className="text-[10px] font-black uppercase text-gray-600">Kayit yok</span>
              ) : (
                positionRows.map(([position, count]) => (
                  <span key={position} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[10px] font-black uppercase text-gray-300">
                    {position}: {count}
                  </span>
                ))
              )}
            </div>
          </section>

          <section className="mt-6 rounded-[1.5rem] border border-white/5 bg-[#121215] p-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Takim Sporculari</p>
            {detail.athletes.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/20 p-6 text-center">
                <Users size={28} className="mx-auto mb-3 text-gray-700" aria-hidden />
                <p className="text-[10px] font-black uppercase text-gray-500">Bu takimda sporcu yok.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {detail.athletes.map((athlete) => (
                  <div key={athlete.id} className="flex min-w-0 items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black italic text-white">{athlete.fullName}</p>
                      <p className="text-[10px] font-black uppercase text-gray-500">
                        #{athlete.number} - {athlete.position}
                      </p>
                    </div>
                    <span className={athlete.isActive ? "ui-badge-success" : "ui-badge-warning"}>
                      {athlete.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
