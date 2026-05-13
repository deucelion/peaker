"use client";

import type { FormEvent } from "react";
import { Droplets, Heart, ShieldCheck, Target } from "lucide-react";
import Notification from "@/components/Notification";
import { MetricBadge } from "./AthleteDetailPrimitives";
import type { ProfileBasic } from "@/types/domain";

/**
 * Faz 7.7 — Sporcu profili (kimlik kartı + edit formu).
 * Davranışsal değişiklik yok; tüm state ve handler'lar parent'tan.
 */
export function AthleteProfileForm({
  player,
  profileDraft,
  positionOptions,
  teamOptions,
  updatingPosition,
  positionMessage,
  onDraftChange,
  onSubmit,
}: {
  player: ProfileBasic;
  profileDraft: {
    fullName: string;
    team: string;
    position: string;
    number: string;
    height: string;
    weight: string;
  };
  positionOptions: string[];
  teamOptions: string[];
  updatingPosition: boolean;
  positionMessage: string | null;
  onDraftChange: (next: Partial<{
    fullName: string;
    team: string;
    position: string;
    number: string;
    height: string;
    weight: string;
  }>) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <section
      id="sporcu-profil"
      className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden group min-w-0"
    >
      <div className="flex flex-col xl:flex-row gap-6 md:gap-8 items-center relative z-10">
        <div className="flex h-24 w-24 shrink-0 transform items-center justify-center rounded-2xl border-2 border-white/10 bg-gradient-to-br from-[#7c3aed] to-[#2e1065] text-3xl font-black italic text-white shadow-lg shadow-[#7c3aed]/15 transition-transform duration-500 sm:h-28 sm:w-28 sm:text-4xl md:rounded-3xl sm:group-hover:rotate-2">
          {player.full_name?.substring(0, 1).toUpperCase()}
        </div>

        <div className="flex-1 space-y-4 text-center xl:text-left min-w-0">
          <div>
            <div className="flex flex-wrap justify-center xl:justify-start items-center gap-2 mb-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest italic ${
                  player.team?.trim()
                    ? "border-white/10 bg-white/10 text-white"
                    : "border-amber-500/35 bg-amber-500/15 text-amber-200"
                }`}
              >
                {player.team?.trim() ? player.team : "Takım belirtilmedi"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic text-white uppercase tracking-tight leading-tight break-words">
              <span className="block sm:inline break-words">{player.full_name?.split(" ")[0]}</span>
              {player.full_name?.includes(" ") ? (
                <>
                  {" "}
                  <span className="text-[#7c3aed] break-words">{player.full_name?.split(" ").slice(1).join(" ")}</span>
                </>
              ) : null}
            </h1>
          </div>

          <div className="flex flex-wrap justify-center xl:justify-start gap-2">
            <MetricBadge
              icon={<Target size={14} />}
              label="MEVKI"
              val={player.position ? player.position : "MEVKİ BELİRTİLMEDİ"}
              color={player.position ? "text-white" : "text-amber-300"}
            />
            <MetricBadge icon={<ShieldCheck size={14} />} label="BOY" val={`${player.height || "--"} CM`} />
            <MetricBadge icon={<Heart size={14} />} label="AĞIRLIK" val={`${player.weight || "--"} KG`} />
            <MetricBadge icon={<Droplets size={14} />} label="FORMA" val={`#${player.number || "--"}`} color="text-[#7c3aed]" />
          </div>

          <form onSubmit={onSubmit} className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
            <input
              value={profileDraft.fullName}
              onChange={(e) => onDraftChange({ fullName: e.target.value })}
              placeholder="Ad soyad"
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed] sm:col-span-2"
            />
            <input
              value={profileDraft.team}
              onChange={(e) => onDraftChange({ team: e.target.value.toUpperCase() })}
              list="athlete-team-options"
              placeholder="Takım (opsiyonel)"
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-[#7c3aed]"
            />
            <datalist id="athlete-team-options">
              {teamOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <input
              value={profileDraft.position}
              onChange={(e) => onDraftChange({ position: e.target.value.toUpperCase() })}
              list="athlete-position-options"
              placeholder="Pozisyon güncelle (opsiyonel)"
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-[#7c3aed]"
            />
            <input
              value={profileDraft.number}
              onChange={(e) => onDraftChange({ number: e.target.value.toUpperCase() })}
              placeholder="Forma no (opsiyonel)"
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-[#7c3aed]"
            />
            <input
              type="number"
              min={50}
              max={260}
              value={profileDraft.height}
              onChange={(e) => onDraftChange({ height: e.target.value })}
              placeholder="Boy (cm)"
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed]"
            />
            <input
              type="number"
              min={20}
              max={300}
              value={profileDraft.weight}
              onChange={(e) => onDraftChange({ weight: e.target.value })}
              placeholder="Kilo (kg)"
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed]"
            />
            <datalist id="athlete-position-options">
              {positionOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={updatingPosition}
              className="min-h-11 rounded-xl bg-[#7c3aed] px-4 py-3 text-[10px] font-black uppercase text-white disabled:opacity-60 sm:hover:bg-[#6d28d9] sm:col-span-2 sm:w-fit"
            >
              {updatingPosition ? "Güncelleniyor..." : "Profili Kaydet"}
            </button>
          </form>
          {positionMessage ? (
            <div className="mt-2 min-w-0 break-words">
              <Notification
                message={positionMessage}
                variant={
                  positionMessage.toLowerCase().includes("güncellendi") ||
                  positionMessage.toLowerCase().includes("guncellendi")
                    ? "success"
                    : "error"
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute top-0 right-0 w-[280px] h-[280px] md:w-[360px] md:h-[360px] bg-[#7c3aed]/10 blur-[100px] -z-0 pointer-events-none rounded-full" />
    </section>
  );
}

export default AthleteProfileForm;
