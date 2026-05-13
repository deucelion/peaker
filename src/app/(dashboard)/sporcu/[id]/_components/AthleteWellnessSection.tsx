"use client";

import Link from "next/link";
import type { WellnessReportRow } from "@/types/performance";

/**
 * Faz 7.7 — Son wellness aside.
 * Sadece görsel; parent'tan `latestWellness` alır.
 */
export function AthleteWellnessSection({ latestWellness }: { latestWellness: WellnessReportRow | null }) {
  return (
    <aside
      id="son-wellness"
      className="flex min-w-0 flex-col gap-4 self-stretch rounded-2xl border border-white/5 bg-[#121215] p-5 shadow-xl md:rounded-3xl md:p-7"
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h2 className="text-base font-black italic uppercase tracking-tight text-white sm:text-lg">
          Son <span className="text-[#7c3aed]">wellness</span>
        </h2>
        <Link
          href="/performans/wellness-detay"
          className="shrink-0 text-[9px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
        >
          Arşiv
        </Link>
      </div>
      {latestWellness ? (
        <div className="space-y-3 rounded-2xl border border-white/5 bg-black/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rapor tarihi</p>
          <p className="text-sm font-black text-white">
            {new Date(latestWellness.report_date).toLocaleDateString("tr-TR", { dateStyle: "long" })}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400">
            {latestWellness.fatigue != null ? <span>Yorgunluk: {latestWellness.fatigue}/10</span> : null}
            {latestWellness.sleep_quality != null ? <span>Uyku: {latestWellness.sleep_quality}/10</span> : null}
            {latestWellness.energy_level != null ? <span>Enerji: {latestWellness.energy_level}/10</span> : null}
            {latestWellness.stress_level != null ? <span>Stres: {latestWellness.stress_level}/10</span> : null}
          </div>
          <Link
            href="#performans-analitigi"
            className="inline-block text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
          >
            Grafikler ve trendler için aşağı kaydırın →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
          <p className="text-[10px] font-bold text-gray-500">Kayıtlı wellness raporu yok.</p>
          <p className="mt-2 text-[10px] text-gray-600">
            Sabah raporu veya wellness girişi yapıldığında burada son kayıt görünür. Tüm arşiv için{" "}
            <Link
              href="/performans/wellness-detay"
              className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
            >
              wellness ekranına
            </Link>{" "}
            gidin.
          </p>
        </div>
      )}
      <p className="mt-auto text-[10px] font-bold text-gray-500">
        Derin analiz:{" "}
        <a href="#performans-analitigi" className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]">
          Performans analitiği
        </a>
      </p>
    </aside>
  );
}

export default AthleteWellnessSection;
