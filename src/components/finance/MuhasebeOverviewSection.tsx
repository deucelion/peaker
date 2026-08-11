"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, Plus } from "lucide-react";
import { loadAccountingFinanceDashboard } from "@/lib/actions/accountingFinanceActions";
import { loadReceivablesDashboard } from "@/lib/actions/receivableDashboardActions";
import { FinanceScopeChip } from "@/components/finance/FinanceScopeChip";
import { HUB_TAB_LABELS, type HubWorkspaceView } from "@/lib/finance/hubViews";
import { hrefTahsilatKaydet } from "@/lib/finance/tahsilatMerkeziLinks";

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

type Props = {
  orgId: string | null;
  onOpenTahsilat: () => void;
  onNavigateSection: (section: HubWorkspaceView, preset?: "gecmis") => void;
};

export function MuhasebeOverviewSection({ orgId, onOpenTahsilat, onNavigateSection }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collected, setCollected] = useState(0);
  const [pendingPeriod, setPendingPeriod] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [debtorCount, setDebtorCount] = useState(0);
  const [overduePackageCount, setOverduePackageCount] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);

  const runFetch = useCallback(async () => {
    setLoading(true);
    const month = monthKeyNow();
    const [finRes, recvRes] = await Promise.all([
      loadAccountingFinanceDashboard({
        orgId,
        month,
        lessonType: "all",
        lessonStatus: "all",
        paymentStatus: "all",
      }),
      loadReceivablesDashboard({ orgId, month }),
    ]);
    if ("error" in finRes) {
      setError(finRes.error);
      setLoading(false);
      return;
    }
    if ("error" in recvRes) {
      setError(recvRes.error);
      setLoading(false);
      return;
    }
    setError(null);
    setCollected(finRes.snapshot.kpis.totalCollected);
    setPendingPeriod(finRes.snapshot.kpis.pendingCollection);
    setTotalLessons(finRes.snapshot.kpis.totalLessons);
    setOverdueAmount(recvRes.snapshot.kpis.overdueReceivable);
    setDebtorCount(recvRes.snapshot.kpis.debtorAthleteCount);
    setOverduePackageCount(recvRes.snapshot.kpis.overduePackageCount);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const quickLinks = useMemo(
    () =>
      [
        { section: "tahsilatlar" as const, label: HUB_TAB_LABELS.tahsilatlar, desc: "Dönemsel tahsilat listesi" },
        { section: "alacaklar" as const, label: HUB_TAB_LABELS.alacaklar, desc: "Borç ve vade takibi" },
        { section: "sporcular" as const, label: HUB_TAB_LABELS.sporcular, desc: "Tüm zaman sporcu özeti" },
        { section: "koclar" as const, label: HUB_TAB_LABELS.koclar, desc: "Koç ders raporu" },
      ] as const,
    []
  );

  if (loading) {
    return (
      <div className="flex min-h-[30dvh] items-center justify-center text-emerald-500">
        <Loader2 className="size-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FinanceScopeChip scope="period" />
        <button
          type="button"
          onClick={onOpenTahsilat}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
        >
          <Plus size={14} aria-hidden />
          Tahsilat kaydet
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="ui-kpi-section rounded-xl p-4">
          <p className="text-[9px] font-black uppercase text-emerald-200/80">Bu ay tahsilat</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-emerald-300">{formatMoney(collected)}</p>
        </article>
        <article className="ui-kpi-section rounded-xl p-4">
          <p className="text-[9px] font-black uppercase text-amber-200/80">Dönem bekleyen</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-amber-300">{formatMoney(pendingPeriod)}</p>
        </article>
        <article className="ui-kpi-section rounded-xl p-4">
          <p className="text-[9px] font-black uppercase text-red-200/80">Gecikmiş alacak</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-red-300">{formatMoney(overdueAmount)}</p>
        </article>
        <article className="ui-kpi-section rounded-xl p-4">
          <p className="text-[9px] font-black uppercase text-gray-400">Bu ay ders</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-gray-100">{totalLessons.toLocaleString("tr-TR")}</p>
        </article>
      </div>

      {(debtorCount > 0 || overduePackageCount > 0) && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} aria-hidden />
            <div>
              <p className="text-sm font-black uppercase text-amber-100">Tahsilat aksiyonu gerekli</p>
              <p className="mt-0.5 text-xs font-semibold text-amber-200/90">
                {debtorCount} sporcuda borç · {overduePackageCount} gecikmiş paket
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection("alacaklar")}
              className="inline-flex min-h-10 items-center rounded-xl border border-amber-400/40 bg-amber-500/20 px-4 text-[10px] font-black uppercase text-amber-100 hover:bg-amber-500/30"
            >
              Alacakları gör
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection("tahsilatlar", "gecmis")}
              className="inline-flex min-h-10 items-center rounded-xl border border-red-500/35 bg-red-500/10 px-4 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/20"
            >
              Bekleyen tahsilatlar
            </button>
          </div>
        </div>
      )}

      <section className="ui-kpi-section rounded-xl p-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Hızlı geçiş</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {quickLinks.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigateSection(item.section)}
              className="group flex items-center justify-between rounded-xl ui-card-inner border px-4 py-3 text-left hover:border-emerald-500/35 hover:bg-emerald-500/5"
            >
              <div>
                <p className="text-xs font-black uppercase text-white">{item.label}</p>
                <p className="text-[10px] font-semibold text-gray-500">{item.desc}</p>
              </div>
              <ChevronRight className="text-gray-600 group-hover:text-emerald-400" size={16} aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <p className="text-[11px] font-semibold text-gray-500">
        Derin bağlantı:{" "}
        <Link href={hrefTahsilatKaydet(orgId)} className="text-emerald-400 underline-offset-2 hover:underline">
          Yeni tahsilat formu
        </Link>
      </p>
    </div>
  );
}
