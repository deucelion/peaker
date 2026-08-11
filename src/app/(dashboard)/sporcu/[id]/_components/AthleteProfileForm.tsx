"use client";

import type { FormEvent, ReactNode } from "react";
import { Droplets, Heart, ShieldCheck, Target } from "lucide-react";
import Notification from "@/components/Notification";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import type { ProfileBasic } from "@/types/domain";

const INPUT_CLASS = uiBrandingClasses.form.input;

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
      className={`${uiBrandingClasses.card.base} group relative min-w-0 overflow-hidden rounded-2xl p-5 shadow-xl md:rounded-3xl md:p-7`}
    >
      <div className="relative z-10 flex flex-col items-center gap-6 md:gap-8 xl:flex-row">
        <div
          className="flex h-24 w-24 shrink-0 transform items-center justify-center rounded-2xl border-2 border-white/5 bg-gradient-to-br from-[color:var(--peaker-ui-PRIMARY)] to-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,#000)] text-3xl font-black italic text-white shadow-lg transition-transform duration-500 sm:h-28 sm:w-28 sm:text-4xl md:rounded-3xl sm:group-hover:rotate-2"
          style={{
            boxShadow:
              "0 10px 15px -3px color-mix(in srgb, var(--peaker-ui-PRIMARY) 15%, transparent)",
          }}
        >
          {player.full_name?.substring(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1 space-y-4 text-center xl:text-left">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 xl:justify-start">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase italic tracking-widest ${
                  player.team?.trim()
                    ? `${uiBrandingClasses.badge.neutral} border-white/10`
                    : `${uiBrandingClasses.badge.warning} border-amber-500/35`
                }`}
              >
                {player.team?.trim() ? player.team : "Takım belirtilmedi"}
              </span>
            </div>
            <h1 className={`${uiBrandingClasses.typography.h1} break-words text-2xl sm:text-3xl md:text-4xl`}>
              <span className="block break-words sm:inline">{player.full_name?.split(" ")[0]}</span>
              {player.full_name?.includes(" ") ? (
                <>
                  {" "}
                  <span className="break-words text-[color:var(--peaker-ui-PRIMARY)]">
                    {player.full_name?.split(" ").slice(1).join(" ")}
                  </span>
                </>
              ) : null}
            </h1>
          </div>

          <div className="flex flex-wrap justify-center gap-2 xl:justify-start">
            <AthleteMetricChip
              icon={<Target size={14} />}
              label="MEVKI"
              val={player.position ? player.position : "MEVKİ BELİRTİLMEDİ"}
              valueClass={player.position ? "text-white" : "text-amber-300"}
            />
            <AthleteMetricChip icon={<ShieldCheck size={14} />} label="BOY" val={`${player.height || "--"} CM`} />
            <AthleteMetricChip icon={<Heart size={14} />} label="AĞIRLIK" val={`${player.weight || "--"} KG`} />
            <AthleteMetricChip
              icon={<Droplets size={14} />}
              label="FORMA"
              val={`#${player.number || "--"}`}
              valueClass={uiBrandingClasses.kpi.cardTrend}
            />
          </div>

          <form onSubmit={onSubmit} className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
            <input
              value={profileDraft.fullName}
              onChange={(e) => onDraftChange({ fullName: e.target.value })}
              placeholder="Ad soyad"
              className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black sm:col-span-2`}
            />
            <input
              value={profileDraft.team}
              onChange={(e) => onDraftChange({ team: e.target.value.toUpperCase() })}
              list="athlete-team-options"
              placeholder="Takım (opsiyonel)"
              className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black uppercase`}
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
              className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black uppercase`}
            />
            <input
              value={profileDraft.number}
              onChange={(e) => onDraftChange({ number: e.target.value.toUpperCase() })}
              placeholder="Forma no (opsiyonel)"
              className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black uppercase`}
            />
            <input
              type="number"
              min={50}
              max={260}
              value={profileDraft.height}
              onChange={(e) => onDraftChange({ height: e.target.value })}
              placeholder="Boy (cm)"
              className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black`}
            />
            <input
              type="number"
              min={20}
              max={300}
              value={profileDraft.weight}
              onChange={(e) => onDraftChange({ weight: e.target.value })}
              placeholder="Kilo (kg)"
              className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black`}
            />
            <datalist id="athlete-position-options">
              {positionOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={updatingPosition}
              className={`${uiBrandingClasses.button.primary} min-h-11 px-4 py-3 text-[10px] sm:col-span-2 sm:w-fit`}
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

      <div
        className="pointer-events-none absolute -z-0 right-0 top-0 h-[280px] w-[280px] rounded-full blur-[100px] md:h-[360px] md:w-[360px]"
        style={{
          backgroundColor: "color-mix(in srgb, var(--peaker-ui-PRIMARY) 10%, transparent)",
        }}
      />
    </section>
  );
}

export default AthleteProfileForm;

function AthleteMetricChip({
  icon,
  label,
  val,
  valueClass = "text-white",
}: {
  icon: ReactNode;
  label: string;
  val: string;
  valueClass?: string;
}) {
  return (
    <div
      className={`${uiBrandingClasses.kpi.chip} group/m flex min-w-0 items-center gap-2.5 !py-2.5 shadow-md transition-all sm:hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] sm:hover:bg-[color-mix(in_srgb,var(--peaker-ui-SURFACE)_40%,#000)]`}
    >
      <span className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)] transition-transform sm:group-hover/m:scale-105">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className={`${uiBrandingClasses.kpi.cardLabel} text-[7px] tracking-wider`}>{label}</span>
        <span className={`${valueClass} break-words text-xs font-black italic tracking-tight sm:text-sm`}>{val}</span>
      </div>
    </div>
  );
}
