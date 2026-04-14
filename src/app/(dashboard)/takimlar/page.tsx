"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Users, ChevronRight } from "lucide-react";
import Notification from "@/components/Notification";
import { createTeamAction, listTeamsForActor } from "@/lib/actions/teamActions";

type TeamRow = {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadTeams(opts?: { keepLoading?: boolean }) {
    if (!opts?.keepLoading) setLoading(true);
    const res = await listTeamsForActor();
    if ("error" in res) {
      setMessage(res.error ?? "Takimlar alinamadi.");
      setTeams([]);
    } else {
      setTeams((res.teams || []) as TeamRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadTeams({ keepLoading: true });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function onCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("name", newTeamName.trim());
    const res = await createTeamAction(fd);
    if ("success" in res && res.success) {
      setNewTeamName("");
      setMessage("Takim olusturuldu.");
      await loadTeams();
    } else {
      setMessage(("error" in res && res.error) || "Takim olusturulamadi.");
    }
    setSubmitting(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, search]);

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">
            TAKIM <span className="text-[#7c3aed]">YONETIMI</span>
          </h1>
          <p className="ui-lead break-words">Takimlari olustur, listele ve detaylarini incele.</p>
        </div>
        <div className="relative w-full min-w-0 shrink-0 md:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="TAKIM ARA..."
            className="ui-input min-h-11 bg-[#121215] border-white/5 pl-10 italic uppercase text-base sm:text-xs touch-manipulation"
          />
        </div>
      </header>

      <form onSubmit={onCreateTeam} className="mt-6 flex min-w-0 flex-col gap-3 rounded-[1.5rem] border border-white/5 bg-[#121215] p-4 sm:flex-row sm:items-center sm:p-5">
        <input
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="Yeni takim adi"
          maxLength={60}
          className="ui-input min-h-11 flex-1 border-white/10 bg-black/40 text-base uppercase sm:text-xs"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-[10px] font-black uppercase text-white disabled:opacity-60 sm:hover:bg-[#6d28d9]"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
          Takim olustur
        </button>
      </form>

      {message ? (
        <div className="mt-4 min-w-0 break-words">
          <Notification message={message} variant={message.toLowerCase().includes("olusturuldu") ? "success" : "error"} />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 flex min-h-[35dvh] min-w-0 flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-[#7c3aed]" size={40} aria-hidden />
          <p className="text-[10px] font-black uppercase italic tracking-widest text-gray-500">Takimlar yukleniyor...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-[2rem] border border-white/5 bg-[#121215] p-8 text-center">
          <Users size={36} className="mx-auto mb-3 text-gray-700" aria-hidden />
          <p className="text-[11px] font-black uppercase italic tracking-widest text-gray-500">Kayitli takim bulunamadi.</p>
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <div
              key={team.id}
              className="group relative min-w-0 rounded-[1.5rem] border border-white/5 bg-[#121215] p-5 transition-all sm:hover:border-[#7c3aed]/30"
            >
              <p className="break-words pr-16 text-lg font-black uppercase italic text-white">{team.name}</p>
              <p className="mt-2 text-[9px] font-black uppercase tracking-[0.15em] text-gray-600">
                {new Date(team.created_at).toLocaleDateString("tr-TR")}
              </p>
              <Link
                href={`/takimlar/${team.id}`}
                className="absolute bottom-4 right-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-3 py-2 text-[9px] font-black uppercase text-[#c4b5fd] opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100"
              >
                Takim detayi <ChevronRight size={12} aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
