"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Trash2, UserCheck, UserMinus } from "lucide-react";
import type { PlayerWithPayments } from "@/types/domain";
import { profileRowIsActive } from "@/lib/coach/lifecycle";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";

/**
 * Tek sporcu kartı. UI birebir korunur; davranış parent'tan handler'larla gelir.
 */
export type AthleteCardProps = {
  player: PlayerWithPayments;
  onDeactivate: (id: string, name: string) => void;
  onReactivate: (id: string, name: string) => void;
  onHardDelete: (id: string, name: string) => void;
};

export function AthleteCard({ player, onDeactivate, onReactivate, onHardDelete }: AthleteCardProps) {
  const active = profileRowIsActive(player.is_active);
  const safeName = player.full_name || "Sporcu";
  const finance = getFinanceStatusPresentation(player.financeSummary);

  return (
    <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] ui-card p-5 shadow-xl transition-all sm:rounded-[3rem] sm:p-6 sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)]">
      {active ? (
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-20 flex items-center gap-2 opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100">
          <button
            type="button"
            title="Kalıcı sil"
            onClick={(e) => {
              e.preventDefault();
              onHardDelete(player.id, safeName);
            }}
            className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-red-500/10 p-0 text-red-400 transition-all sm:hover:bg-red-500 sm:hover:text-white"
          >
            <Trash2 size={16} aria-hidden />
          </button>
          <button
            type="button"
            title="Pasife al"
            onClick={(e) => {
              e.preventDefault();
              onDeactivate(player.id, safeName);
            }}
            className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-amber-500/10 p-0 text-amber-400 transition-all sm:hover:bg-amber-500 sm:hover:text-black"
          >
            <UserMinus size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-20 flex items-center gap-2 opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100">
          <button
            type="button"
            title="Kalıcı sil"
            onClick={(e) => {
              e.preventDefault();
              onHardDelete(player.id, safeName);
            }}
            className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-red-500/10 p-0 text-red-400 transition-all sm:hover:bg-red-500 sm:hover:text-white"
          >
            <Trash2 size={16} aria-hidden />
          </button>
          <button
            type="button"
            title="Tekrar aktif et"
            onClick={(e) => {
              e.preventDefault();
              onReactivate(player.id, safeName);
            }}
            className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-emerald-500/10 p-0 text-emerald-400 transition-all sm:hover:bg-emerald-500 sm:hover:text-black"
          >
            <UserCheck size={16} aria-hidden />
          </button>
        </div>
      )}

      <div className="flex items-center gap-5 mb-6 min-w-0">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)] font-black text-2xl italic text-[color:var(--peaker-ui-PRIMARY)] shadow-inner transition-all sm:group-hover:border-[color:var(--peaker-ui-PRIMARY)]">
          {player.avatar_url ? (
            <Image
              src={player.avatar_url}
              className="w-full h-full object-cover"
              alt=""
              width={64}
              height={64}
            />
          ) : (
            <span className="uppercase">{player.full_name?.[0]}</span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tighter leading-tight mb-2 sm:group-hover:text-[color:var(--peaker-ui-PRIMARY)] transition-colors break-words pr-12 md:pr-0">
            {player.full_name}
          </h3>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest italic flex items-center gap-2 flex-wrap">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-green-500" : "bg-amber-500"}`}
            />
            <span
              className={
                active
                  ? "ui-badge-success !px-2 !py-0.5 !text-[9px] !bg-emerald-500/5 !border-emerald-500/20 text-gray-400"
                  : "ui-badge-warning !px-2 !py-0.5 !text-[9px]"
              }
            >
              {active ? "Aktif" : "Pasif"}
            </span>
            <span className="text-gray-600">•</span>
            {player.position || "GELİŞİM"} • #{player.number || "00"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="/50 p-5 rounded-[2rem] text-center">
          <p className="text-[8px] text-gray-600 font-black uppercase mb-1 tracking-widest italic">BOY / KİLO</p>
          <p className="text-xs font-black text-gray-300 italic leading-none">
            {player.height || "0"}cm / {player.weight || "0"}kg
          </p>
        </div>
        <div className="/50 p-5 rounded-[2rem] text-center">
          <p className="text-[8px] text-gray-600 font-black uppercase mb-1 tracking-widest italic">KATEGORİ</p>
          <p className="text-[9px] font-black text-[color:var(--peaker-ui-PRIMARY)] italic uppercase break-words">
            {player.team || "GENEL"}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl ui-card-inner p-3 text-[10px] font-bold">
        <p className="text-gray-500">Aktif paket</p>
        <p className="text-right text-white">{player.activePackageName || "Yok"}</p>
        <p className="text-gray-500">Kalan ders</p>
        <p className="text-right text-white tabular-nums">{player.remainingLessons ?? "—"}</p>
        <p className="text-gray-500">Finans durumu</p>
        <div className="text-right">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${finance.badgeClass}`}
          >
            {finance.label}
          </span>
        </div>
        <p className="text-gray-500">Son ders</p>
        <p className="text-right text-white">
          {player.lastLessonAt ? new Date(player.lastLessonAt).toLocaleDateString("tr-TR") : "—"}
        </p>
      </div>

      <Link href={`/sporcu/${player.id}`} className="mt-auto touch-manipulation">
        <span className="ui-btn-ghost inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl text-[9px] uppercase tracking-[0.2em] shadow-xl sm:min-h-11 sm:tracking-[0.3em] sm:hover:bg-[color:var(--peaker-ui-PRIMARY)] sm:hover:text-white">
          PROFİLİ İNCELE <ChevronRight size={14} aria-hidden />
        </span>
      </Link>
    </div>
  );
}
