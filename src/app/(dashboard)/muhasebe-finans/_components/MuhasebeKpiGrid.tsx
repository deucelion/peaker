"use client";

import type { AccountingFinanceSnapshot } from "@/lib/actions/accountingFinanceActions";

type Kpis = AccountingFinanceSnapshot["kpis"] | undefined;

function formatMoney(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

export function MuhasebeKpiGridGeneral({ kpis }: { kpis: Kpis }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
        <span
          className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-200"
          title="KPI değerleri yalnızca yukarıda seçili dönem (ay veya tarih aralığı) için hesaplanır."
        >
          Bu dönem
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
          title="Yalnızca seçili dönemde tahsil edilen tutar"
        >
          <p className="text-[9px] font-black uppercase text-emerald-200/80">Toplam tahsilat</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-300">
            {formatMoney(kpis?.totalCollected || 0)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Seçili dönemde alınan tahsilat</p>
        </article>
        <article
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
          title="Seçili dönemde bekleyen ödemeler + bu dönemde hareket gören paketlerin kalan bakiyesi. Tüm zaman bakiyesi için Sporcu ödemeleri sekmesine bakın."
        >
          <p className="text-[9px] font-black uppercase text-amber-200/80">Bekleyen tahsilat</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-amber-300">
            {formatMoney(kpis?.pendingCollection || 0)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Bu dönem operasyonel bakiye</p>
        </article>
        <article
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
          title="Yalnızca seçili dönem"
        >
          <p className="text-[9px] font-black uppercase text-gray-400">Toplam ders</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-gray-100">
            {(kpis?.totalLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Seçili dönemdeki tüm dersler</p>
        </article>
        <article
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
          title="Yalnızca seçili dönem"
        >
          <p className="text-[9px] font-black uppercase text-gray-400">Tamamlanan ders</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">
            {(kpis?.completedLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Tamamlanan ders kayıtları</p>
        </article>
      </div>
    </section>
  );
}

export function MuhasebeKpiGridCoaches({ kpis }: { kpis: Kpis }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase text-gray-400">Toplam ders</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-gray-100">
            {(kpis?.totalLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Filtrelenmiş tüm dersler</p>
        </article>
        <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase text-gray-400">Tamamlanan</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">
            {(kpis?.completedLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Tamamlanan oturumlar</p>
        </article>
        <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase text-gray-400">Planlanan</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-gray-200">
            {(kpis?.plannedLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Gelecek / açık dersler</p>
        </article>
        <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase text-gray-400">İptal</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-red-200">
            {(kpis?.cancelledLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">İptal edilen dersler</p>
        </article>
        <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase text-gray-400">Aktif koç</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-cyan-200">
            {(kpis?.activeCoachCount ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Bu dönemde dersi olan koç</p>
        </article>
      </div>
    </section>
  );
}
