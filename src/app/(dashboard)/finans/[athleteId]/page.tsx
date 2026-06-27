"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { CollectionPaymentForm } from "@/components/finance/CollectionPaymentForm";
import {
  getAthleteFinanceDetailForManagement,
  markPlannedAidatAsPaidForManagement,
  softDeleteOrgPayment,
  updateAthleteNextAidatPlanForManagement,
  updateOrgPaymentStatus,
} from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import {
  buildUnifiedAthletePaymentTimeline,
  filterUnifiedTimeline,
  type UnifiedAthletePaymentFilter,
} from "@/lib/finance/unifiedAthletePaymentTimeline";
import { hrefTahsilatMerkezi } from "@/lib/finance/tahsilatMerkeziLinks";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { LoadMoreButton } from "@/components/ui/data-display";

const FINANCE_TIMELINE_PAGE_SIZE = 50;

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

export default function FinanceAthleteDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : params.athleteId?.[0] || "";
  const fromWorkspace = searchParams.get("from") === "workspace";
  const backHref = fromWorkspace ? `${PATHS.tahsilatMerkezi}?bolum=sporcu` : "/finans";
  const backLabel = fromWorkspace ? "← Muhasebe & Finans" : "← Sporcu Ödemeleri";

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AthleteFinanceDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [markingPlannedPaid, setMarkingPlannedPaid] = useState(false);
  const [paymentFormResetKey, setPaymentFormResetKey] = useState(0);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ dueDate: "", amount: "" });
  const [activeTab, setActiveTab] = useState<FinanceTab>("tumu");
  const [unifiedFilter, setUnifiedFilter] = useState<UnifiedAthletePaymentFilter>("all");
  const [canOpenAccountingPanel, setCanOpenAccountingPanel] = useState(false);

  const load = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    const res = await getAthleteFinanceDetailForManagement(athleteId);
    if ("error" in res) {
      setMessage(res.error);
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setSnapshot(res);
    setPlanForm({
      dueDate: res.nextAidatPlan.dueDate || "",
      amount: res.nextAidatPlan.amount != null ? String(res.nextAidatPlan.amount) : "",
    });
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void (async () => {
        const me = await fetchMeRoleClient();
        if (cancelled || !me.ok) return;
        setCanOpenAccountingPanel(me.role === "admin" || me.role === "super_admin");
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  const combinedPrivatePaid = useMemo(
    () => (snapshot?.privateLessonPayments || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [snapshot]
  );
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

  // Faz 9.5 — client-side incremental pagination over the unified timeline.
  // Büyük org'larda tek sporcunun yüzlerce kaydı olabilir; ilk 50 + load-more.
  const [timelinePageCount, setTimelinePageCount] = useState(1);
  const visibleTimelineLines = useMemo(
    () => unifiedFilteredLines.slice(0, timelinePageCount * FINANCE_TIMELINE_PAGE_SIZE),
    [unifiedFilteredLines, timelinePageCount]
  );
  useEffect(() => {
    // Filter değişince sayfa sıfırla. Effect içinde direkt setState'i
    // engellemek için cascade önlemi: değer zaten 1 ise dokunma.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimelinePageCount((p) => (p === 1 ? p : 1));
  }, [unifiedFilter, unifiedAllLines]);

  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot) return;
    setPlanSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("athlete_id", snapshot.athlete.id);
    fd.append("next_due_date", planForm.dueDate);
    fd.append("next_amount", planForm.amount);
    const res = await updateAthleteNextAidatPlanForManagement(fd);
    if ("error" in res) {
      setMessage(res.error || "Ödeme planı güncellenemedi.");
    } else {
      setMessage("Sonraki ödeme planı güncellendi.");
      await load();
    }
    setPlanSaving(false);
  }

  async function handleDeletePayment(paymentId: string) {
    const fd = new FormData();
    fd.append("payment_id", paymentId);
    fd.append("delete_reason", "ui_manual_delete");
    const res = await softDeleteOrgPayment(fd);
    if ("error" in res) {
      setMessage(res.error || "Ödeme kaydı kaldırılamadı.");
      return;
    }
    setMessage("Ödeme kaydı kaldırıldı.");
    await load();
  }

  async function handleMarkPlannedPaid() {
    if (!snapshot) return;
    setMarkingPlannedPaid(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("athlete_id", snapshot.athlete.id);
    const res = await markPlannedAidatAsPaidForManagement(fd);
    if ("error" in res) {
      setMessage(res.error || "Planlanan ödeme tamamlanamadı.");
    } else {
      setMessage("Planlanan ödeme tamamlandı olarak işlendi.");
      await load();
    }
    setMarkingPlannedPaid(false);
  }

  async function handleStatusUpdate(paymentId: string, status: "odendi" | "bekliyor") {
    setStatusSavingId(paymentId);
    setMessage(null);
    const res = await updateOrgPaymentStatus(paymentId, status);
    if ("error" in res) setMessage(res.error || "Ödeme durumu güncellenemedi.");
    else {
      setMessage("Ödeme durumu güncellendi.");
      await load();
    }
    setStatusSavingId(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center text-white">
        <Loader2 className="size-10 animate-spin text-green-500" aria-hidden />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="text-[10px] font-black uppercase text-green-400">{backLabel}</Link>
        <Notification message={message || "Finans detayi alinamadi."} variant="error" />
      </div>
    );
  }

  const dueDateLabel = formatDate(snapshot.summary.nextDueDate);
  const dueAmountLabel = formatCurrency(snapshot.summary.nextAmount);
  const summaryPresentation = getFinanceStatusPresentation(snapshot.summary);
  const ozelDersPaymentCount = snapshot.privateLessonPayments.length;
  const showPrimaryAction = snapshot.summary.tone !== "paid";
  const primaryActionLabel =
    snapshot.summary.tone === "overdue" ? "Tahsilat durumunu yönet" : "Tahsilat özetini aç";
  const accountingOrgId =
    snapshot.aidatPayments[0]?.organization_id ??
    snapshot.privateLessonPackages[0]?.organizationId ??
    null;
  const tahsilatMerkeziHref = hrefTahsilatMerkezi({
    profileId: snapshot.athlete.id,
    organizationId: accountingOrgId,
  });

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className="text-[10px] font-black uppercase text-green-400">{backLabel}</Link>
          {canOpenAccountingPanel && !fromWorkspace ? (
            <Link
              href={PATHS.tahsilatMerkezi}
              className="inline-flex min-h-10 items-center rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-3 text-[10px] font-black uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/25"
            >
              Muhasebe &amp; Finans
            </Link>
          ) : null}
        </div>
        <h1 className="text-2xl font-black uppercase italic text-white">
          {snapshot.athlete.fullName} · Finans Detayı
        </h1>
      </div>
      <p className="text-xs font-semibold text-gray-400">
        Sporcu bazlı borç, ödeme ve tahsilat durumlarını yönetin.
      </p>

      {message ? (
        <Notification
          message={message}
          variant={message.toLowerCase().includes("guncellendi") || message.toLowerCase().includes("olusturuldu") ? "success" : "error"}
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className={`rounded-2xl border p-5 md:col-span-2 ${summaryPresentation.cardClass}`}>
          <p className="text-[9px] font-black uppercase tracking-widest">Finans Durumu</p>
          <p className="mt-2 text-lg font-black uppercase italic">{summaryPresentation.label}</p>
          <p className="mt-2 text-[11px] font-semibold text-white/90">{summaryPresentation.supportText}</p>
          <div className="mt-3 grid gap-2 rounded-xl border border-white/20 bg-black/20 px-3 py-3 text-[11px] font-semibold leading-relaxed text-white/90 sm:grid-cols-2">
            <p>Sonraki ödeme tarihi: <span className="font-black">{dueDateLabel}</span></p>
            <p>Sonraki ödeme tutarı: <span className="font-black">{dueAmountLabel}</span></p>
          </div>
          <div className="mt-3 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-[11px] font-semibold leading-relaxed text-white/90">
            {summaryActionMessage(snapshot.summary)}
          </div>
          {showPrimaryAction ? (
            <button
              type="button"
              disabled={markingPlannedPaid}
              onClick={() => void handleMarkPlannedPaid()}
              className="mt-4 min-h-11 w-full rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wide text-black transition-opacity disabled:opacity-60 md:w-auto md:min-w-[220px]"
            >
              {markingPlannedPaid ? "İşleniyor..." : primaryActionLabel}
            </button>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#121215] p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Özet</p>
          <p className="mt-2 text-lg font-black text-emerald-400">{formatCurrency(snapshot.totals.aidatPaidTotal)}</p>
          <p className="text-[10px] font-semibold text-gray-500">Aidat tahsilatı toplamı</p>
          <p className="text-xs font-semibold text-red-300">Aidat bekleyen: {formatCurrency(snapshot.totals.aidatPendingTotal)}</p>
          <p className="mt-2 text-xs font-semibold text-[#c4b5fd]">Özel ders tahsilatı: {formatCurrency(combinedPrivatePaid)}</p>
          <p className="text-xs font-semibold text-gray-400">{snapshot.privateLessonPackages.length} paket • {ozelDersPaymentCount} ödeme</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121215] p-2 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("tumu")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "tumu" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Tüm Tahsilatlar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hizmet")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "hizmet" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
            }`}
          >
            Paket ve Hizmetler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`min-h-11 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider ${
              activeTab === "plan" ? "bg-green-600 text-white" : "bg-black/30 text-gray-300"
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
              <p className="text-[10px] font-semibold text-gray-500">
                Aidat, ek tahsilat ve özel ders paketi ödemeleri tek listede ({unifiedFilteredLines.length}
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
                    unifiedFilter === key ? "bg-green-600 text-white" : "border border-white/15 bg-black/30 text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {unifiedFilteredLines.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">
                  Bu filtreye uygun tahsilat yok. Farklı bir filtre deneyin veya yeni kayıt ekleyin.
                </p>
                {unifiedFilter === "all" && onboardingPrivatePayments.length > 0 && snapshot.aidatPayments.length === 0 ? (
                  <p className="text-xs font-semibold text-[#c4b5fd]">
                    Onboarding ödemeleri paket defterinde listelenir; yukarıda Paket filtresi veya Paket ve Hizmetler sekmesinden görebilirsiniz.
                  </p>
                ) : null}
              </div>
            ) : (
              visibleTimelineLines.map((line) => {
                const paymentRow =
                  line.refKind === "payment"
                    ? snapshot.aidatPayments.find((r) => r.id === line.refId) ||
                      snapshot.legacyPackagePayments.find((r) => r.id === line.refId) ||
                      null
                    : null;
                const borderClass =
                  line.statusTone === "paid" ? "border-white/10" : "border-amber-500/25 bg-amber-500/5";
                return (
                  <div key={line.id} className={`rounded-xl border bg-black/20 p-3 ${borderClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                      <span className="shrink-0 text-sm font-black tabular-nums text-white">{formatCurrency(line.amount)}</span>
                    </div>
                    {paymentRow ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {paymentRow.status === "odendi" ? (
                          <button
                            type="button"
                            onClick={() => void handleStatusUpdate(paymentRow.id, "bekliyor")}
                            disabled={statusSavingId === paymentRow.id}
                            className="min-h-10 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[10px] font-black uppercase text-amber-300"
                          >
                            {statusSavingId === paymentRow.id ? "..." : "Bekliyor Olarak İşaretle"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleStatusUpdate(paymentRow.id, "odendi")}
                            disabled={statusSavingId === paymentRow.id}
                            className="min-h-10 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[10px] font-black uppercase text-emerald-300"
                          >
                            {statusSavingId === paymentRow.id ? "..." : "Ödendi Olarak İşaretle"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeletePayment(paymentRow.id)}
                          className="min-h-10 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-300"
                        >
                          Kaydı Kaldır
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] font-semibold text-gray-500">
                        Paket defteri satırları bu ekrandan silinemez; paket sayfasından yönetilir.
                      </p>
                    )}
                  </div>
                );
              })
            )}
            <LoadMoreButton
              loaded={visibleTimelineLines.length}
              total={unifiedFilteredLines.length}
              loading={false}
              onClick={() => setTimelinePageCount((p) => p + 1)}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "hizmet" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Özel Ders Paketleri</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">Özel ders paket ve ödemeleri</p>
            <div className="mt-3 space-y-2">
              {snapshot.privateLessonPackages.length === 0 ? (
                <p className="text-xs font-bold text-gray-500">Henüz özel ders paketi bulunmuyor.</p>
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
          <div className="rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h2 className="text-sm font-black uppercase text-white">Paket ve Hizmet Tahsilatları</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">Ödeme kayıtları ({ozelDersPaymentCount})</p>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {snapshot.privateLessonPayments.length === 0 ? (
                <p className="text-xs font-bold text-gray-500">Henüz özel ders ödeme geçmişi yok.</p>
              ) : (
                snapshot.privateLessonPayments.map((pay) => (
                  <div key={pay.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white">{formatCurrency(pay.amount)}</p>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(pay.paidAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {(pay.note || "").toLowerCase().includes("onboarding") ? (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#c4b5fd]">Kaynak: Onboarding</p>
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
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={handlePlanSubmit} className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-3">
            <h2 className="text-sm font-black uppercase text-white">Planlı Aidat Tahsilatı</h2>
            <p className="text-[10px] font-semibold text-gray-500">Bu alan yalnızca aylık aidat planı içindir.</p>
            <input
              type="date"
              value={planForm.dueDate}
              onChange={(e) => setPlanForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <input
              type="number"
              value={planForm.amount}
              onChange={(e) => setPlanForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="Bir sonraki ödeme tutarı (₺)"
              className="w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white"
            />
            <button disabled={planSaving} className="min-h-11 rounded-xl bg-green-600 px-4 text-[10px] font-black uppercase text-white">
              {planSaving ? "Kaydediliyor..." : "Planı Kaydet"}
            </button>
            <button
              type="button"
              disabled={markingPlannedPaid}
              onClick={() => void handleMarkPlannedPaid()}
              className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-[10px] font-black uppercase text-emerald-300"
            >
              {markingPlannedPaid ? "İşleniyor..." : "Planlı aidatı tamamlandı olarak işaretle"}
            </button>
          </form>
          {canOpenAccountingPanel ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 space-y-3">
              <h2 className="text-sm font-black uppercase text-white">Manuel tahsilat</h2>
              <p className="text-[10px] font-semibold text-gray-400">
                Yönetici tahsilatları tek yerden girilir; bu kayıtlar Muhasebe &amp; Finans tahsilat listesi ve özel ders
                paketi defteri ile aynı kalır.
              </p>
              <Link
                href={tahsilatMerkeziHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
              >
                Tahsilat Merkezinde aç
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-3">
              <h2 className="text-sm font-black uppercase text-white">Manuel Tahsilat Ekle</h2>
              <p className="text-[10px] font-semibold text-gray-500">
                Özel ders paketi seçildiğinde mevcut paketler listelenir; paket yoksa uyarı gösterilir (muhasebe akışı ile
                aynı).
              </p>
              <CollectionPaymentForm
                variant="management"
                lockedProfileId={snapshot.athlete.id}
                organizationIdFromUrl={accountingOrgId}
                athletes={[{ id: snapshot.athlete.id, full_name: snapshot.athlete.fullName }]}
                resetKey={paymentFormResetKey}
                layout="page"
                onError={(err) => setMessage(err)}
                onSuccess={async () => {
                  setMessage("Tahsilat kaydi olusturuldu.");
                  setPaymentFormResetKey((k) => k + 1);
                  await load();
                }}
              />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
