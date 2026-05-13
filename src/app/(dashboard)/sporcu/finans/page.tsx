"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { getMyFinanceDetailForAthlete } from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
import {
  buildUnifiedAthletePaymentTimeline,
  filterUnifiedTimeline,
  type UnifiedAthletePaymentFilter,
} from "@/lib/finance/unifiedAthletePaymentTimeline";

type FinanceTab = "tumu" | "hizmet" | "plan";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "-";
  return dateFormatter.format(dt);
}

function summaryActionMessage(summary: AthleteFinanceDetail["summary"]) {
  return getFinanceStatusPresentation(summary).supportText;
}

export default function AthleteFinanceDetailPage() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AthleteFinanceDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<
    "permission_denied" | "auth_required" | "invalid_input" | "fetch_error" | null
  >(null);
  const [activeTab, setActiveTab] = useState<FinanceTab>("tumu");
  const [unifiedFilter, setUnifiedFilter] = useState<UnifiedAthletePaymentFilter>("all");

  useEffect(() => {
    async function run() {
      setLoading(true);
      const res = await getMyFinanceDetailForAthlete();
      if ("error" in res) {
        setSnapshot(null);
        setMessage(res.error);
        setMessageKind(
          ("errorKind" in res && typeof res.errorKind === "string"
            ? (res.errorKind as
                | "permission_denied"
                | "auth_required"
                | "invalid_input"
                | "fetch_error")
            : "fetch_error")
        );
      } else {
        setSnapshot(res);
        setMessageKind(null);
      }
      setLoading(false);
    }
    void run();
  }, []);

  const onboardingPrivatePayments = useMemo(
    () => (snapshot?.privateLessonPayments || []).filter((row) => (row.note || "").toLowerCase().includes("onboarding")),
    [snapshot]
  );

  const unifiedAllLines = useMemo(() => {
    if (!snapshot) return [];
    return buildUnifiedAthletePaymentTimeline({
      aidatPayments: snapshot.aidatPayments,
      legacyPackagePayments: snapshot.legacyPackagePayments,
      privateLessonPayments: snapshot.privateLessonPayments,
      privateLessonPackages: snapshot.privateLessonPackages,
      timeZone: snapshot.timeZone,
    });
  }, [snapshot]);

  const unifiedFilteredLines = useMemo(
    () => filterUnifiedTimeline(unifiedAllLines, unifiedFilter),
    [unifiedAllLines, unifiedFilter]
  );

  if (loading) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-[#7c3aed]" aria-hidden />
      </div>
    );
  }

  if (!snapshot) {
    if (messageKind === "permission_denied") {
      return (
        <div className="space-y-4">
          <Link href="/sporcu" className="text-[10px] font-black uppercase text-[#7c3aed]">← Sporcu Paneli</Link>
          <div
            className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100"
            role="status"
            aria-live="polite"
          >
            <p className="text-[11px] font-black uppercase tracking-wide">Bu alanı görüntüleme yetkiniz yok.</p>
            <p className="mt-1 text-[10px] font-semibold text-amber-200/80 normal-case">{message}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Link href="/sporcu" className="text-[10px] font-black uppercase text-[#7c3aed]">← Sporcu Paneli</Link>
        <Notification message={message || "Finans detay alinamadi."} variant="error" />
      </div>
    );
  }

  const dueDateLabel = formatDate(snapshot.summary.nextDueDate);
  const dueAmountLabel = formatCurrency(snapshot.summary.nextAmount);
  const summaryPresentation = getFinanceStatusPresentation(snapshot.summary);
  const ozelDersPaymentCount = snapshot.privateLessonPayments.length;
  const showPrimaryAction = snapshot.summary.tone !== "paid";
  const primaryActionLabel = snapshot.summary.tone === "overdue" ? "Ödemeyi Tamamla" : "Erken Ödeme Yap";

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/sporcu" className="text-[10px] font-black uppercase text-[#7c3aed]">← Sporcu Paneli</Link>
        <h1 className="text-2xl font-black uppercase italic text-white">Finans Detayı</h1>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ana Finans Bilgisi</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-black uppercase text-gray-500">Ödenecek Tutar</p>
            <p className="mt-1 text-xl font-black text-white">{dueAmountLabel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-black uppercase text-gray-500">Son Ödeme Tarihi</p>
            <p className="mt-1 text-xl font-black text-white">{dueDateLabel}</p>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-5 ${summaryPresentation.cardClass}`}>
        <p className="text-[9px] font-black uppercase tracking-widest">Ödeme Durumu</p>
        <p className="mt-2 text-2xl font-black uppercase italic">{summaryPresentation.label}</p>
        <p className="mt-2 text-[11px] font-semibold text-white/90">{summaryPresentation.supportText}</p>
        <p className="mt-2 text-[10px] font-semibold text-white/80">
          Sonraki ödeme: {dueDateLabel} - {dueAmountLabel}
        </p>
        <div className="mt-3 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-[11px] font-bold leading-relaxed text-white/90">
          {summaryActionMessage(snapshot.summary)}
        </div>
        {showPrimaryAction ? (
          <button
            type="button"
            onClick={() => setActiveTab("tumu")}
            className="mt-4 min-h-11 w-full rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wide text-black md:w-auto md:min-w-[220px]"
          >
            {primaryActionLabel}
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Özel Ders Toplamı</p>
        <p className="mt-2 text-lg font-black text-[#c4b5fd]">{formatCurrency(snapshot.totals.privateLessonPaidTotal)}</p>
        <p className="text-xs font-semibold text-gray-400">{snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} ödeme</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-2 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("tumu")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "tumu" ? "bg-[#7c3aed] text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Tüm Tahsilatlar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hizmet")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "hizmet" ? "bg-[#7c3aed] text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Paket ve Hizmetler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "plan" ? "bg-[#7c3aed] text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Planlı Aidat Tahsilatı
          </button>
        </div>
      </section>

      {activeTab === "tumu" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase text-white">Tüm Tahsilatlar</h2>
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                Aidat, ek tahsilat ve paket ödemeleriniz ({unifiedFilteredLines.length}
                {unifiedFilter !== "all" ? ` / ${unifiedAllLines.length}` : ""} kayıt).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tümü"],
                  ["membership", "Aidat"],
                  ["package", "Paket"],
                  ["extra", "Özel tahsilat"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUnifiedFilter(key)}
                  className={`min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide ${
                    unifiedFilter === key ? "bg-[#7c3aed] text-white" : "border border-white/15 bg-black/30 text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {unifiedFilteredLines.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">Bu filtreye uygun kayıt yok.</p>
                {unifiedFilter === "all" && onboardingPrivatePayments.length > 0 && snapshot.aidatPayments.length === 0 ? (
                  <p className="text-xs font-semibold text-[#c4b5fd]">
                    Onboarding ödemeleri paket defterindedir; Paket filtresi veya Paket ve Hizmetler sekmesine bakın.
                  </p>
                ) : null}
              </div>
            ) : (
              unifiedFilteredLines.map((line) => {
                const borderClass =
                  line.statusTone === "paid" ? "border-white/10" : "border-amber-500/25 bg-amber-500/5";
                return (
                  <div key={line.id} className={`rounded-xl border bg-black/20 p-3 ${borderClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-black text-white">{line.title}</p>
                        <p className="text-[10px] font-bold text-gray-500">{line.detail}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase text-gray-400">
                            {line.scopeLabel}
                          </span>
                          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase text-gray-400">
                            {line.kindLabel}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${
                              line.statusTone === "paid"
                                ? "border border-emerald-500/30 text-emerald-300"
                                : "border border-amber-500/30 text-amber-200"
                            }`}
                          >
                            {line.statusLabel}
                          </span>
                          {line.sourceBadge ? (
                            <span className="rounded-md border border-[#c4b5fd]/35 bg-[#c4b5fd]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[#c4b5fd]">
                              {line.sourceBadge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="shrink-0 text-xs font-black tabular-nums text-white">{formatCurrency(line.amount)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "hizmet" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Paket ve Hizmet Tahsilatları</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">Toplam {ozelDersPaymentCount} ödeme kaydı listeleniyor.</p>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {snapshot.privateLessonPayments.length === 0 ? (
                <p className="text-xs font-semibold text-gray-500">Henüz özel ders ödeme kaydı yok.</p>
              ) : (
                snapshot.privateLessonPayments.map((row) => (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white">{formatCurrency(row.amount)}</p>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(row.paidAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {(row.note || "").toLowerCase().includes("onboarding") ? (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#c4b5fd]">Kaynak: Onboarding</p>
                    ) : null}
                    {row.note ? <p className="mt-1 text-[10px] font-bold text-gray-400">{row.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Paket Özeti</h2>
            <div className="mt-3 space-y-2">
              {snapshot.privateLessonPackages.length === 0 ? (
                <p className="text-xs font-semibold text-gray-500">Henüz özel ders paketi bulunmuyor.</p>
              ) : (
                snapshot.privateLessonPackages.map((pkg) => (
                  <div key={pkg.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-black text-white">{pkg.packageName}</p>
                    <p className="text-[10px] font-bold text-gray-500">
                      {pkg.paymentStatus.toUpperCase()} · {pkg.usedLessons}/{pkg.totalLessons} ders · ₺{pkg.amountPaid.toLocaleString("tr-TR")} / ₺{pkg.totalPrice.toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "plan" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Planlı Aidat Tahsilatı</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-500">
            Bir sonraki aidat planı yönetim tarafından belirlenir.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Tarih</p>
              <p className="mt-2 text-sm font-black text-white">{snapshot.summary.nextDueDate || "-"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Tutar</p>
              <p className="mt-2 text-sm font-black text-white">₺{snapshot.summary.nextAmount ?? 0}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] font-semibold text-gray-500">
            Bu alanda yalnızca bilgi gösterilir. Güncelleme işlemleri yönetim panelinden yapılır.
          </p>
        </section>
      ) : null}
    </div>
  );
}
