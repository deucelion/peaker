"use client";

import type { AccountingFinanceSnapshot } from "@/lib/actions/accountingFinanceActions";

type Kpis = AccountingFinanceSnapshot["kpis"] | undefined;

function formatMoney(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

export function MuhasebeKpiGridGeneral({ kpis }: { kpis: Kpis }) {
  return (
    <section className="ui-kpi-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
        <span
          className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-200"
          title="KPI değerleri yalnızca yukarıda seçili dönem (ay veya tarih aralığı) için hesaplanır."
        >
          Bu dönem
        </span>
      </div>
      <div className="ui-kpi-grid">
        <article className="ui-kpi-card" title="Yalnızca seçili dönemde tahsil edilen tutar">
          <p className="text-[9px] font-black uppercase text-emerald-200/80">Toplam tahsilat</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-300">
            {formatMoney(kpis?.totalCollected || 0)}
          </p>
          <p className="ui-kpi-card__hint mt-1">Seçili dönemde alınan tahsilat</p>
        </article>
        <article
          className="ui-kpi-card"
          title="Seçili dönemde bekleyen ödemeler + bu dönemde hareket gören paketlerin kalan bakiyesi. Tüm zaman bakiyesi için Sporcu ödemeleri sekmesine bakın."
        >
          <p className="text-[9px] font-black uppercase text-amber-200/80">Bekleyen tahsilat</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-amber-300">
            {formatMoney(kpis?.pendingCollection || 0)}
          </p>
          <p className="ui-kpi-card__hint mt-1">Bu dönem operasyonel bakiye</p>
        </article>
        <article className="ui-kpi-card" title="Yalnızca seçili dönem">
          <p className="ui-kpi-card__label">Toplam ders</p>
          <p className="ui-kpi-card__value mt-0.5">
            {(kpis?.totalLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">Seçili dönemdeki tüm dersler</p>
        </article>
        <article className="ui-kpi-card" title="Yalnızca seçili dönem">
          <p className="ui-kpi-card__label">Tamamlanan ders</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">
            {(kpis?.completedLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">Tamamlanan ders kayıtları</p>
        </article>
      </div>
    </section>
  );
}

export function MuhasebeKpiGridCoaches({ kpis }: { kpis: Kpis }) {
  return (
    <section className="ui-kpi-section">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
      <div className="ui-kpi-grid ui-kpi-grid--5">
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">Toplam ders</p>
          <p className="ui-kpi-card__value mt-0.5">
            {(kpis?.totalLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">Filtrelenmiş tüm dersler</p>
        </article>
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">Tamamlanan</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">
            {(kpis?.completedLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">Tamamlanan oturumlar</p>
        </article>
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">Planlanan</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-gray-200">
            {(kpis?.plannedLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">Gelecek / açık dersler</p>
        </article>
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">İptal</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-red-200">
            {(kpis?.cancelledLessons ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">İptal edilen dersler</p>
        </article>
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">Aktif koç</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-cyan-200">
            {(kpis?.activeCoachCount ?? 0).toLocaleString("tr-TR")}
          </p>
          <p className="ui-kpi-card__hint mt-1">Bu dönemde dersi olan koç</p>
        </article>
      </div>
    </section>
  );
}
