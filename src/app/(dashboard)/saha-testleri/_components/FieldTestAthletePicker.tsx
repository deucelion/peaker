"use client";

import { useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import type { ProfileBasic } from "@/types/domain";
import { filterFieldTestAthletes } from "@/lib/fieldTests/filterFieldTestAthletes";

export function FieldTestAthletePicker({
  players,
  activeAthleteId,
  completedAthleteIds,
  onSelect,
}: {
  players: ProfileBasic[];
  activeAthleteId: string | null;
  completedAthleteIds: ReadonlySet<string>;
  onSelect: (athleteId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterFieldTestAthletes(players, query), [players, query]);

  return (
    <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#121215] p-4">
      <div className="flex items-center gap-2">
        <UserRound size={16} className="shrink-0 text-[#7c3aed]" aria-hidden />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sporcu seç</p>
      </div>
      <label className="relative block">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İsimle ara…"
          className="ui-input min-h-11 w-full pl-10"
          autoComplete="off"
        />
      </label>
      <div className="max-h-[min(320px,45dvh)] space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] font-semibold text-gray-500">Eşleşen sporcu yok.</p>
        ) : (
          filtered.map((player) => {
            const active = player.id === activeAthleteId;
            const done = completedAthleteIds.has(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelect(player.id)}
                className={`flex w-full min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left transition touch-manipulation ${
                  active
                    ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                    : "border-white/8 bg-black/20 text-gray-300 hover:border-[#7c3aed]/30 hover:bg-white/[0.03]"
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-black italic ${
                    active ? "bg-[#7c3aed] text-white" : "bg-[#1c1c21] text-gray-500"
                  }`}
                >
                  {player.full_name.substring(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-tight">
                  {player.full_name}
                </span>
                {done ? (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-300">
                    Veri var
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
      <p className="text-[10px] font-semibold text-gray-500">
        {completedAthleteIds.size}/{players.length} sporcuda bugün kayıt var
      </p>
    </div>
  );
}
