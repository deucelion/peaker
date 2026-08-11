"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { useEffect, useMemo, useState } from "react";
import type { AthleteFinanceDetail } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
import {
  buildUnifiedAthletePaymentTimeline,
  filterUnifiedTimeline,
  type UnifiedAthletePaymentFilter,
} from "@/lib/finance/unifiedAthletePaymentTimeline";
import {
  FINANCE_TIMELINE_PAGE_SIZE,
  formatAthleteFinanceCurrency,
  formatAthleteFinanceDate,
  type FinanceTab,
} from "@/lib/finance/athleteFinanceFormatters";
import { LoadMoreButton } from "@/components/ui/data-display";

export type AthleteFinanceTimelineProps = {
  snapshot: AthleteFinanceDetail;
  mode: "readonly" | "management";
  accent?: "purple" | "green";
  statusSavingId?: string | null;
  markingPlannedPaid?: boolean;
  onStatusUpdate?: (paymentId: string, status: "odendi" | "bekliyor") => void;
  onDeletePayment?: (paymentId: string) => void;
  onMarkPlannedPaid?: () => void;
};

function tabActiveClass(accent: "purple" | "green", active: boolean) {
  if (!active) return "ui-tabs-nav__tab--inactive text-gray-300";
  return accent === "purple" ? "bg-[color:var(--peaker-ui-PRIMARY)] text-white" : "bg-green-600 text-white";
}

function filterActiveClass(accent: "purple" | "green", active: boolean) {
  if (!active) return "ui-tabs-nav__tab--inactive text-gray-300";
  return accent === "purple" ? "bg-[color:var(--peaker-ui-PRIMARY)] text-white" : "bg-green-600 text-white";
}

export function AthleteFinanceTimeline({
  snapshot,
  mode,
  accent = mode === "readonly" ? "purple" : "green",
  statusSavingId = null,
  markingPlannedPaid = false,
  onStatusUpdate,
  onDeletePayment,
  onMarkPlannedPaid,
}: AthleteFinanceTimelineProps) {
  const [activeTab, setActiveTab] = useState<FinanceTab>("tumu");
  const [unifiedFilter, setUnifiedFilter] = useState<UnifiedAthletePaymentFilter>("all");
  const [timelinePageCount, setTimelinePageCount] = useState(1);

  const summaryPresentation = getFinanceStatusPresentation(snapshot.summary);
  const dueDateLabel = formatAthleteFinanceDate(snapshot.summary.nextDueDate);
  const dueAmountLabel = formatAthleteFinanceCurrency(snapshot.summary.nextAmount);
  const ozelDersPaymentCount = snapshot.privateLessonPayments.length;

  const combinedPrivatePaid = useMemo(
    () => snapshot.privateLessonPayments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [snapshot.privateLessonPayments]
  );

  const onboardingPrivatePayments = useMemo(
    () => snapshot.privateLessonPayments.filter((row) => (row.note || "").toLowerCase().includes("onboarding")),
    [snapshot.privateLessonPayments]
  );

  const unifiedAllLines = useMemo(
    () =>
      buildUnifiedAthletePaymentTimeline({
        aidatPayments: snapshot.aidatPayments,
        legacyPackagePayments: snapshot.legacyPackagePayments,
        privateLessonPayments: snapshot.privateLessonPayments,
        privateLessonPackages: snapshot.privateLessonPackages,
        timeZone: snapshot.timeZone,
      }),
    [snapshot]
  );

  const unifiedFilteredLines = useMemo(
    () => filterUnifiedTimeline(unifiedAllLines, unifiedFilter),
    [unifiedAllLines, unifiedFilter]
  );

  const visibleTimelineLines = useMemo(
    () =>
      mode === "management"
        ? unifiedFilteredLines.slice(0, timelinePageCount * FINANCE_TIMELINE_PAGE_SIZE)
        : unifiedFilteredLines,
    [mode, unifiedFilteredLines, timelinePageCount]
  );

  useEffect(() => {
    setTimelinePageCount((p) => (p === 1 ? p : 1));
  }, [unifiedFilter, unifiedAllLines]);

  const showPrimaryAction = snapshot.summary.tone !== "paid";
  const primaryActionLabel =
    mode === "readonly"
      ? snapshot.summary.tone === "overdue"
        ? "Tahsilat durumunu görüntüle"
        : "Tahsilat özetini görüntüle"
      : snapshot.summary.tone === "overdue"
        ? "Tahsilat durumunu yönet"
        : "Tahsilat özetini aç";

  return (
    <div className="space-y-6">
      {mode === "readonly" ? (
        <>
          <section className="ui-card rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ana Finans Bilgisi</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl ui-card-inner border p-3">
                <p className="text-[10px] font-black uppercase text-gray-500">Ödenmesi gereken tutar</p>
                <p className="mt-1 text-xl font-black text-white">{dueAmountLabel}</p>
              </div>
              <div className="rounded-xl ui-card-inner border p-3">
                <p className="text-[10px] font-black uppercase text-gray-500">Planlanan vade tarihi</p>
                <p className="mt-1 text-xl font-black text-white">{dueDateLabel}</p>
              </div>
            </div>
          </section>
          <section className={`rounded-2xl border p-5 ${summaryPresentation.cardClass}`}>
            <p className="text-[9px] font-black uppercase tracking-widest">Tahsilat durumu</p>
            <p className="mt-2 text-2xl font-black uppercase italic">{summaryPresentation.label}</p>
            <p className="mt-2 text-[11px] font-semibold text-white/90">{summaryPresentation.supportText}</p>
            <p className="mt-2 text-[10px] font-semibold text-white/80">
              Sonraki vade (takip): {dueDateLabel} - {dueAmountLabel}
            </p>
            <div className={`${uiBrandingClasses.card.inner} mt-3 rounded-xl px-3 py-2 text-[11px] font-bold leading-relaxed text-white/90`}>
              {summaryPresentation.supportText}
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
          <section className="ui-card rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Özel Ders Toplamı</p>
            <p className="mt-2 text-lg font-black ui-kpi-card__trend">{formatAthleteFinanceCurrency(snapshot.totals.privateLessonPaidTotal)}</p>
            <p className="text-xs font-semibold text-gray-400">
              {snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} tahsilat kaydı
            </p>
          </section>
        </>
      ) : (
        <section className="grid gap-3 md:grid-cols-3">
          <div className={`rounded-2xl border p-5 md:col-span-2 ${summaryPresentation.cardClass}`}>
            <p className="text-[9px] font-black uppercase tracking-widest">Finans Durumu</p>
            <p className="mt-2 text-lg font-black uppercase italic">{summaryPresentation.label}</p>
            <p className="mt-2 text-[11px] font-semibold text-white/90">{summaryPresentation.supportText}</p>
            <div className={`${uiBrandingClasses.card.inner} mt-3 grid gap-2 rounded-xl px-3 py-3 text-[11px] font-semibold leading-relaxed text-white/90 sm:grid-cols-2`}>
              <p>
                Sonraki ödeme tarihi: <span className="font-black">{dueDateLabel}</span>
              </p>
              <p>
                Sonraki ödeme tutarı: <span className="font-black">{dueAmountLabel}</span>
              </p>
            </div>
            <div className={`${uiBrandingClasses.card.inner} mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold leading-relaxed text-white/90`}>
              {summaryPresentation.supportText}
            </div>
            {showPrimaryAction && onMarkPlannedPaid ? (
              <button
                type="button"
                disabled={markingPlannedPaid}
                onClick={onMarkPlannedPaid}
                className="mt-4 min-h-11 w-full rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wide text-black transition-opacity disabled:opacity-60 md:w-auto md:min-w-[220px]"
              >
                {markingPlannedPaid ? "İşleniyor..." : primaryActionLabel}
              </button>
            ) : null}
          </div>
          <div className="ui-card rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Özet</p>
            <p className="mt-2 text-lg font-black text-emerald-400">{formatAthleteFinanceCurrency(snapshot.totals.aidatPaidTotal)}</p>
            <p className="text-[10px] font-semibold text-gray-500">Aidat tahsilatı toplamı</p>
            <p className="text-xs font-semibold text-red-300">
              Aidat bekleyen: {formatAthleteFinanceCurrency(snapshot.totals.aidatPendingTotal)}
            </p>
            <p className="mt-2 text-xs font-semibold ui-kpi-card__trend">
              Özel ders tahsilatı: {formatAthleteFinanceCurrency(combinedPrivatePaid)}
            </p>
            <p className="text-xs font-semibold text-gray-400">
              {snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} ödeme
            </p>
          </div>
        </section>
      )}

      <section className="ui-card rounded-2xl p-2 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ["tumu", "Tüm Tahsilatlar"],
              ["hizmet", "Paket ve Hizmetler"],
              ["plan", "Planlı Aidat Tahsilatı"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${tabActiveClass(accent, activeTab === key)}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "tumu" ? (
        <section className="space-y-4 ui-card rounded-2xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase text-white">Tüm Tahsilatlar</h2>
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                Aidat, ek tahsilat ve paket ödemeleri ({unifiedFilteredLines.length}
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
                  className={`min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide ${filterActiveClass(accent, unifiedFilter === key)}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={`space-y-2 overflow-y-auto pr-1 ${mode === "management" ? "max-h-[520px] space-y-3" : "max-h-[420px]"}`}>
            {unifiedFilteredLines.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">
                  {mode === "management"
                    ? "Bu filtreye uygun tahsilat yok. Farklı bir filtre deneyin veya yeni kayıt ekleyin."
                    : "Bu filtreye uygun kayıt yok."}
                </p>
                {unifiedFilter === "all" && onboardingPrivatePayments.length > 0 && snapshot.aidatPayments.length === 0 ? (
                  <p className="text-xs font-semibold ui-kpi-card__trend">
                    Onboarding ödemeleri paket defterinde listelenir; Paket filtresi veya Paket ve Hizmetler sekmesine bakın.
                  </p>
                ) : null}
              </div>
            ) : (
              visibleTimelineLines.map((line) => {
                const paymentRow =
                  mode === "management" && line.refKind === "payment"
                    ? snapshot.aidatPayments.find((r) => r.id === line.refId) ||
                      snapshot.legacyPackagePayments.find((r) => r.id === line.refId) ||
                      null
                    : null;
                const borderClass =
                  line.statusTone === "paid" ? "border-white/10" : "border-amber-500/25 bg-amber-500/5";
                return (
                  <div key={line.id} className={`ui-card-inner rounded-xl border p-3 ${borderClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-black text-white">{line.title}</p>
                        <p className="text-[10px] font-bold text-gray-500">{line.detail}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="rounded-md ui-kpi-band border px-2 py-0.5 text-[9px] font-black uppercase text-gray-400">
                            {line.scopeLabel}
                          </span>
                          <span className="rounded-md ui-kpi-band border px-2 py-0.5 text-[9px] font-black uppercase text-gray-400">
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
                            <span className={`${uiBrandingClasses.kpi.chipBrand} rounded-md px-2 py-0.5 text-[9px] font-black uppercase`}>
                              {line.sourceBadge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="shrink-0 text-xs font-black tabular-nums text-white">{formatAthleteFinanceCurrency(line.amount)}</p>
                    </div>
                    {mode === "management" && paymentRow && onStatusUpdate && onDeletePayment ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {paymentRow.status === "odendi" ? (
                          <button
                            type="button"
                            onClick={() => onStatusUpdate(paymentRow.id, "bekliyor")}
                            disabled={statusSavingId === paymentRow.id}
                            className="min-h-10 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[10px] font-black uppercase text-amber-300"
                          >
                            {statusSavingId === paymentRow.id ? "..." : "Bekliyor Olarak İşaretle"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStatusUpdate(paymentRow.id, "odendi")}
                            disabled={statusSavingId === paymentRow.id}
                            className="min-h-10 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[10px] font-black uppercase text-emerald-300"
                          >
                            {statusSavingId === paymentRow.id ? "..." : "Ödendi Olarak İşaretle"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeletePayment(paymentRow.id)}
                          className="min-h-10 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-300"
                        >
                          Kaydı Kaldır
                        </button>
                      </div>
                    ) : null}
                    {mode === "management" && line.refKind === "payment" && !paymentRow ? (
                      <p className="mt-2 text-[10px] font-semibold text-gray-500">
                        Paket defteri satırları bu ekrandan silinemez; paket sayfasından yönetilir.
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
            {mode === "management" ? (
              <LoadMoreButton
                loaded={visibleTimelineLines.length}
                total={unifiedFilteredLines.length}
                loading={false}
                onClick={() => setTimelinePageCount((p) => p + 1)}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "hizmet" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="ui-card rounded-2xl p-5">
            <h2 className="text-sm font-black uppercase text-white">
              {mode === "management" ? "Özel Ders Paketleri" : "Paket ve Hizmet Tahsilatları"}
            </h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">
              {mode === "management"
                ? "Özel ders paket ve ödemeleri"
                : `Toplam ${ozelDersPaymentCount} ödeme kaydı listeleniyor.`}
            </p>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {mode === "management" ? (
                snapshot.privateLessonPackages.length === 0 ? (
                  <p className="text-xs font-bold text-gray-500">Henüz özel ders paketi bulunmuyor.</p>
                ) : (
                  snapshot.privateLessonPackages.map((pkg) => (
                    <div key={pkg.id} className="rounded-xl ui-card-inner border p-3">
                      <p className="text-xs font-black text-white">{pkg.packageName}</p>
                      <p className="text-[10px] font-bold text-gray-500">
                        {pkg.paymentStatus.toUpperCase()} · {pkg.usedLessons}/{pkg.totalLessons} ders · ₺
                        {pkg.amountPaid.toLocaleString("tr-TR")} / ₺{pkg.totalPrice.toLocaleString("tr-TR")}
                      </p>
                    </div>
                  ))
                )
              ) : snapshot.privateLessonPayments.length === 0 ? (
                <p className="text-xs font-semibold text-gray-500">Henüz özel ders ödeme kaydı yok.</p>
              ) : (
                snapshot.privateLessonPayments.map((row) => (
                  <div key={row.id} className="rounded-xl ui-card-inner border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white">{formatAthleteFinanceCurrency(row.amount)}</p>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(row.paidAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {(row.note || "").toLowerCase().includes("onboarding") ? (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wide ui-kpi-card__trend">Kaynak: Onboarding</p>
                    ) : null}
                    {row.note ? <p className="mt-1 text-[10px] font-bold text-gray-400">{row.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="ui-card rounded-2xl p-5">
            <h2 className="text-sm font-black uppercase text-white">
              {mode === "management" ? "Paket ve Hizmet Tahsilatları" : "Paket Özeti"}
            </h2>
            <div className="mt-3 space-y-2">
              {mode === "readonly" ? (
                snapshot.privateLessonPackages.length === 0 ? (
                  <p className="text-xs font-semibold text-gray-500">Henüz özel ders paketi bulunmuyor.</p>
                ) : (
                  snapshot.privateLessonPackages.map((pkg) => (
                    <div key={pkg.id} className="rounded-xl ui-card-inner border p-3">
                      <p className="text-xs font-black text-white">{pkg.packageName}</p>
                      <p className="text-[10px] font-bold text-gray-500">
                        {pkg.paymentStatus.toUpperCase()} · {pkg.usedLessons}/{pkg.totalLessons} ders · ₺
                        {pkg.amountPaid.toLocaleString("tr-TR")} / ₺{pkg.totalPrice.toLocaleString("tr-TR")}
                      </p>
                    </div>
                  ))
                )
              ) : snapshot.privateLessonPayments.length === 0 ? (
                <p className="text-xs font-bold text-gray-500">Henüz özel ders ödeme geçmişi yok.</p>
              ) : (
                snapshot.privateLessonPayments.map((pay) => (
                  <div key={pay.id} className="rounded-xl ui-card-inner border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white">{formatAthleteFinanceCurrency(pay.amount)}</p>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(pay.paidAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {(pay.note || "").toLowerCase().includes("onboarding") ? (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wide ui-kpi-card__trend">Kaynak: Onboarding</p>
                    ) : null}
                    {pay.note ? <p className="mt-1 text-[10px] font-bold text-gray-400">{pay.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "plan" ? (
        <section className="ui-card rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase text-white">Planlı Aidat Tahsilatı</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-500">
            {mode === "readonly"
              ? "Bir sonraki aidat planı yönetim tarafından belirlenir."
              : "Bu alan yalnızca aylık aidat planı içindir."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl ui-card-inner border p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Tarih</p>
              <p className="mt-2 text-sm font-black text-white">{snapshot.summary.nextDueDate || "-"}</p>
            </div>
            <div className="rounded-xl ui-card-inner border p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Tutar</p>
              <p className="mt-2 text-sm font-black text-white">₺{snapshot.summary.nextAmount ?? 0}</p>
            </div>
          </div>
          {mode === "readonly" ? (
            <p className="mt-3 text-[10px] font-semibold text-gray-500">
              Bu alanda yalnızca bilgi gösterilir. Güncelleme işlemleri yönetim panelinden yapılır.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
