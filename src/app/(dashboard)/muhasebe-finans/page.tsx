"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Notification from "@/components/Notification";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import {
  loadAccountingFinanceDashboard,
  createAccountingPayment,
  type AccountingFinanceSnapshot,
  type AccountingFinanceFilters,
} from "@/lib/actions/accountingFinanceActions";
import {
  getAccountingLessonStatusLabel,
  getAccountingLessonTypeLabel,
  getAccountingCoachPayoutTrackingLabel,
  getAccountingPayoutCalculationLabel,
  getAccountingPaymentKindLabel,
  getAccountingPaymentStatusLabel,
} from "@/lib/accountingFinance/labels";
import { addCoachPayoutItem, markCoachPayoutAsPaid } from "@/lib/actions/coachPayoutActions";
import { listCoachPaymentRulesForAccounting, upsertCoachPaymentRule } from "@/lib/actions/coachPaymentRuleActions";

const LESSON_STATUS_OPTIONS = [
  { value: "all", label: "Tüm durumlar" },
  { value: "planned", label: getAccountingLessonStatusLabel("planned") },
  { value: "completed", label: getAccountingLessonStatusLabel("completed") },
  { value: "cancelled", label: getAccountingLessonStatusLabel("cancelled") },
] as const;

const LESSON_TYPE_OPTIONS = [
  { value: "all", label: "Tüm ders tipleri" },
  { value: "group", label: getAccountingLessonTypeLabel("group") },
  { value: "private", label: getAccountingLessonTypeLabel("private") },
] as const;

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "Tüm tahsilat durumları" },
  { value: "bekliyor", label: getAccountingPaymentStatusLabel("bekliyor") },
  { value: "odendi", label: getAccountingPaymentStatusLabel("odendi") },
] as const;

const PAYOUT_TRACKING_STATUS_OPTIONS = [
  { value: "all", label: "Tüm durumlar" },
  { value: "pending", label: "Ödeme Bekliyor" },
  { value: "included", label: "Koç Ödemesi Listesine Alındı" },
  { value: "paid", label: "Koç Ödemesi Tamamlandı" },
] as const;

const PAYMENT_KIND_FORM_OPTIONS = [
  { value: "monthly_membership", label: "Aylık Üyelik" },
  { value: "private_lesson_package", label: "Özel Ders Paketi" },
  { value: "license", label: "Lisans" },
  { value: "event", label: "Etkinlik" },
  { value: "equipment", label: "Ekipman" },
  { value: "manual_other", label: "Diğer" },
] as const;

function formatMoney(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const date = new Date(year || 0, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) return "Dönem seçilmedi";
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function getPaymentStatusBadgeClass(status: "bekliyor" | "odendi") {
  return status === "odendi"
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/35 bg-amber-500/10 text-amber-200";
}

function getPayoutStatusBadgeClass(status: "eligible" | "included" | "paid" | null, isEligible: boolean) {
  if (!isEligible) return "border-white/10 bg-white/5 text-gray-300";
  if (status === "paid") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (status === "included") return "border-indigo-500/35 bg-indigo-500/10 text-indigo-200";
  return "border-amber-500/35 bg-amber-500/10 text-amber-200";
}

function getCalculationBadgeClass(status: "ok" | "no_rule" | "no_price" | "not_eligible") {
  if (status === "ok") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (status === "no_rule") return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  if (status === "no_price") return "border-indigo-500/35 bg-indigo-500/10 text-indigo-200";
  return "border-white/10 bg-white/5 text-gray-300";
}

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Kompakt süreç özeti — detay tabloda. */
/** Veri kaynağı şeffaflığı — kısa, güven hissi. */
function DataSourceHint({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] font-semibold leading-relaxed text-gray-500 ${className}`}>
      Veriler ders kayıtları ve tahsilatlardan otomatik hesaplanır. Filtrelere göre güncellenir.
    </p>
  );
}

function CoachPayoutFlowMini() {
  return (
    <p className="text-[10px] font-semibold text-gray-500" title="Tamamlanan ders → listeye al → ödendi">
      <span className="font-black uppercase tracking-wide text-gray-600">Koç ödeme akışı:</span>{" "}
      <span className="text-gray-400">Ödeme bekliyor</span>
      <span className="mx-1 text-gray-600">→</span>
      <span className="text-gray-400">Listeye alındı</span>
      <span className="mx-1 text-gray-600">→</span>
      <span className="text-gray-400">Ödendi</span>
    </p>
  );
}

function readOrgFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("org");
}

export default function MuhasebeFinansPage() {
  const router = useRouter();
  const recordsSectionRef = useRef<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = useState<AccountingFinanceSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"genel" | "coach-payout-items">("genel");
  const [rowActionBusyKey, setRowActionBusyKey] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [filters, setFilters] = useState({
    month: monthKeyNow(),
    dateFrom: "",
    dateTo: "",
    coachId: "",
    lessonType: "all",
    lessonStatus: "all",
    paymentKind: "",
    paymentStatus: "all",
  });
  const [coachPayoutFilters, setCoachPayoutFilters] = useState({
    month: monthKeyNow(),
    dateFrom: "",
    dateTo: "",
    coachId: "",
    lessonType: "all",
    payoutStatus: "all",
  });
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rules, setRules] = useState<
    Array<{
      id: string;
      coach_id: string;
      payment_type: "per_lesson" | "percentage";
      amount: number | null;
      percentage: number | null;
      applies_to: "group" | "private" | "all";
    }>
  >([]);
  const [ruleForm, setRuleForm] = useState({
    coachId: "",
    appliesTo: "all",
    paymentType: "per_lesson",
    amount: "",
    percentage: "",
  });
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    profileId: "",
    amount: "",
    paymentKind: "monthly_membership",
    paymentDate: new Date().toISOString().slice(0, 10),
    description: "",
    packageId: "",
  });
  const [filtersAdvancedOpen, setFiltersAdvancedOpen] = useState(false);
  const [coachPayoutFiltersAdvancedOpen, setCoachPayoutFiltersAdvancedOpen] = useState(false);
  const [coachPayoutSectionHighlight, setCoachPayoutSectionHighlight] = useState(false);
  const [canOpenAthletePayments, setCanOpenAthletePayments] = useState(false);
  const [refreshAck, setRefreshAck] = useState(false);

  const openCoachPayoutFlow = useCallback(() => {
    setActiveView("coach-payout-items");
    setCoachPayoutSectionHighlight(true);
    window.setTimeout(() => {
      recordsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    window.setTimeout(() => {
      setCoachPayoutSectionHighlight(false);
    }, 750);
  }, []);

  const goToTrainingManagement = useCallback(() => {
    router.push("/antrenman-yonetimi?modul=haftalik-takvim");
  }, [router]);

  const resetGeneralFilters = useCallback(() => {
    setActionFeedback(null);
    setFilters({
      month: monthKeyNow(),
      dateFrom: "",
      dateTo: "",
      coachId: "",
      lessonType: "all",
      lessonStatus: "all",
      paymentKind: "",
      paymentStatus: "all",
    });
    setFiltersAdvancedOpen(false);
  }, []);

  const resetCoachPayoutFilters = useCallback(() => {
    setActionFeedback(null);
    setCoachPayoutFilters({
      month: monthKeyNow(),
      dateFrom: "",
      dateTo: "",
      coachId: "",
      lessonType: "all",
      payoutStatus: "all",
    });
    setCoachPayoutFiltersAdvancedOpen(false);
  }, []);

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    const activeFilters = activeView === "genel" ? filters : coachPayoutFilters;
    const payload: AccountingFinanceFilters = {
      orgId: readOrgFromUrl(),
      month: activeFilters.month,
      dateFrom: activeFilters.dateFrom || undefined,
      dateTo: activeFilters.dateTo || undefined,
      coachId: activeFilters.coachId || undefined,
      lessonType: activeFilters.lessonType as AccountingFinanceFilters["lessonType"],
      lessonStatus: activeView === "genel" ? (filters.lessonStatus as AccountingFinanceFilters["lessonStatus"]) : "all",
      paymentKind: activeView === "genel" ? filters.paymentKind || undefined : undefined,
      paymentStatus: activeView === "genel" ? (filters.paymentStatus as AccountingFinanceFilters["paymentStatus"]) : "all",
    };
    const res = await loadAccountingFinanceDashboard(payload);
    if ("error" in res) {
      setLoadError(res.error);
      setSnapshot(null);
      setLoading(false);
      return false;
    }
    setLoadError(null);
    setSnapshot(res.snapshot);
    setLoading(false);
    return true;
  }, [activeView, coachPayoutFilters, filters]);

  const refreshDashboardHard = useCallback(async () => {
    const ok = await fetchData();
    router.refresh();
    if (ok) {
      setRefreshAck(true);
      window.setTimeout(() => setRefreshAck(false), 2600);
    }
  }, [fetchData, router]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void fetchData();
      }, 400);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    const res = await listCoachPaymentRulesForAccounting(readOrgFromUrl());
    if ("error" in res) {
      setActionFeedback({ type: "error", message: res.error || "Koç ödeme kuralları alınamadı." });
      setRulesLoading(false);
      return;
    }
    setRules(
      (res.rules || []).map((row) => ({
        id: row.id,
        coach_id: row.coach_id,
        payment_type: row.payment_type,
        amount: row.amount,
        percentage: row.percentage,
        applies_to: row.applies_to,
      }))
    );
    setRulesLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  useEffect(() => {
    if (!showRuleModal) return;
    const id = setTimeout(() => {
      void fetchRules();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchRules, showRuleModal]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void (async () => {
        const me = await fetchMeRoleClient();
        if (cancelled || !me.ok) return;
        setCanOpenAthletePayments(me.role === "admin");
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  const paymentKindOptions = useMemo(() => snapshot?.options.paymentKinds || [], [snapshot]);
  const periodLabel = useMemo(
    () => formatMonthLabel(activeView === "genel" ? filters.month : coachPayoutFilters.month),
    [activeView, coachPayoutFilters.month, filters.month]
  );
  const coachPayoutRows = useMemo(() => {
    const rows = (snapshot?.lessons || []).filter((row) => row.coachPayoutEligible);
    return rows.filter((row) => {
      if (coachPayoutFilters.coachId && row.coachId !== coachPayoutFilters.coachId) return false;
      if (coachPayoutFilters.lessonType !== "all" && row.sourceType !== coachPayoutFilters.lessonType) return false;
      if (coachPayoutFilters.dateFrom) {
        const fromMs = new Date(`${coachPayoutFilters.dateFrom}T00:00:00`).getTime();
        if (new Date(row.startsAt).getTime() < fromMs) return false;
      }
      if (coachPayoutFilters.dateTo) {
        const toMs = new Date(`${coachPayoutFilters.dateTo}T23:59:59`).getTime();
        if (new Date(row.startsAt).getTime() > toMs) return false;
      }
      if (coachPayoutFilters.payoutStatus === "pending") return !row.payoutStatus;
      if (coachPayoutFilters.payoutStatus === "included") return row.payoutStatus === "included";
      if (coachPayoutFilters.payoutStatus === "paid") return row.payoutStatus === "paid";
      return true;
    });
  }, [coachPayoutFilters, snapshot]);
  const coachPayoutKpis = useMemo(
    () => ({
      pending: coachPayoutRows.filter((row) => !row.payoutStatus).length,
      included: coachPayoutRows.filter((row) => row.payoutStatus === "included").length,
      paid: coachPayoutRows.filter((row) => row.payoutStatus === "paid").length,
      amountTotal: coachPayoutRows.reduce((sum, row) => sum + (row.payoutAmount || 0), 0),
      amountPending: coachPayoutRows.filter((row) => row.payoutStatus !== "paid").reduce((sum, row) => sum + (row.payoutAmount || 0), 0),
      amountPaid: coachPayoutRows.filter((row) => row.payoutStatus === "paid").reduce((sum, row) => sum + (row.payoutAmount || 0), 0),
    }),
    [coachPayoutRows]
  );

  const paymentAmountValue = Number(paymentForm.amount || "0");
  const paymentSubmitDisabled =
    paymentSubmitting || !paymentForm.profileId || !Number.isFinite(paymentAmountValue) || paymentAmountValue <= 0 || !paymentForm.paymentDate;
  const ruleAmountValue = Number(ruleForm.amount || "0");
  const rulePercentageValue = Number(ruleForm.percentage || "0");
  const ruleSubmitDisabled =
    ruleSubmitting ||
    !ruleForm.coachId ||
    (ruleForm.paymentType === "per_lesson"
      ? !Number.isFinite(ruleAmountValue) || ruleAmountValue <= 0
      : !Number.isFinite(rulePercentageValue) || rulePercentageValue <= 0 || rulePercentageValue > 100);

  const handleAddPayout = useCallback(
    async (row: NonNullable<AccountingFinanceSnapshot["lessons"]>[number]) => {
      if (!row.coachId) {
        setActionFeedback({ type: "error", message: "Derse atanmış koç bulunamadı." });
        return;
      }
      const busyKey = `include-${row.payoutSourceType}-${row.id}`;
      setRowActionBusyKey(busyKey);
      const res = await addCoachPayoutItem({
        sourceType: row.payoutSourceType,
        sourceId: row.id,
        coachId: row.coachId,
        organizationId: readOrgFromUrl(),
      });
      if ("error" in res) {
        setActionFeedback({ type: "error", message: res.error || "Koç ödeme kalemi eklenemedi." });
      } else {
        setActionFeedback({ type: "success", message: "Ders koç ödeme listesine alındı." });
        await refreshDashboardHard();
      }
      setRowActionBusyKey(null);
    },
    [refreshDashboardHard]
  );

  const handleMarkPaid = useCallback(
    async (payoutId: string) => {
      const busyKey = `paid-${payoutId}`;
      setRowActionBusyKey(busyKey);
      const res = await markCoachPayoutAsPaid(payoutId, readOrgFromUrl());
      if ("error" in res) {
        setActionFeedback({ type: "error", message: res.error || "Koç ödeme durumu güncellenemedi." });
      } else {
        setActionFeedback({ type: "success", message: "Koç ödeme kalemi ödendi olarak işaretlendi." });
        await refreshDashboardHard();
      }
      setRowActionBusyKey(null);
    },
    [refreshDashboardHard]
  );

  const handleRuleSubmit = useCallback(async () => {
    setRuleSubmitting(true);
    const fd = new FormData();
    fd.set("organizationId", readOrgFromUrl() || "");
    fd.set("coachId", ruleForm.coachId);
    fd.set("appliesTo", ruleForm.appliesTo);
    fd.set("paymentType", ruleForm.paymentType);
    if (ruleForm.paymentType === "per_lesson") fd.set("amount", ruleForm.amount);
    else fd.set("percentage", ruleForm.percentage);
    const res = await upsertCoachPaymentRule(fd);
    if ("error" in res) {
      setActionFeedback({ type: "error", message: res.error });
      setRuleSubmitting(false);
      return;
    }
    setActionFeedback({ type: "success", message: "Koç ödeme kuralı kaydedildi." });
    await fetchRules();
    await refreshDashboardHard();
    setRuleSubmitting(false);
    setShowRuleModal(false);
  }, [fetchRules, refreshDashboardHard, ruleForm]);

  const handlePaymentSubmit = useCallback(async () => {
    setPaymentSubmitting(true);
    const fd = new FormData();
    fd.set("organizationId", readOrgFromUrl() || "");
    fd.set("profileId", paymentForm.profileId);
    fd.set("amount", paymentForm.amount);
    fd.set("paymentKind", paymentForm.paymentKind);
    fd.set("paymentDate", paymentForm.paymentDate);
    fd.set("description", paymentForm.description);
    if (paymentForm.paymentKind === "private_lesson_package" && paymentForm.packageId) {
      fd.set("packageId", paymentForm.packageId);
    }
    const res = await createAccountingPayment(fd);
    if ("error" in res) {
      setActionFeedback({ type: "error", message: res.error || "Tahsilat kaydı oluşturulamadı." });
      setPaymentSubmitting(false);
      return;
    }
    setActionFeedback({ type: "success", message: "Tahsilat kaydı başarıyla eklendi." });
    await refreshDashboardHard();
    setPaymentSubmitting(false);
    setShowPaymentModal(false);
  }, [paymentForm, refreshDashboardHard]);

  if (loading && !snapshot && !loadError) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center text-green-500">
        <Loader2 className="size-10 animate-spin" aria-hidden />
      </div>
    );
  }

  const lessonRows = activeView === "genel" ? snapshot?.lessons || [] : coachPayoutRows;
  const lessonsEmpty = lessonRows.length === 0;

  return (
    <div className="ui-page-loose space-y-5 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121215] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="ui-h1">
            Muhasebe & <span className="text-green-500">Finans</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Tahsilat ve ders özetleri. Sporcu borç / tahsilat detayı{" "}
            {canOpenAthletePayments ? (
              <button type="button" onClick={() => router.push("/finans")} className="text-emerald-400 underline-offset-2 hover:underline">
                Sporcu ödemeleri
              </button>
            ) : (
              <span className="text-gray-500">Sporcu ödemeleri</span>
            )}{" "}
            ekranında.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300">
            Dönem: <span className="ml-1 text-white">{periodLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshDashboardHard()}
              disabled={loading}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:bg-white/5 disabled:opacity-50"
              title="Sunucudan verileri yeniden yükle"
              aria-busy={loading && !!snapshot}
            >
              {loading && snapshot ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
              Yenile
            </button>
            {refreshAck ? (
              <span className="text-[10px] font-semibold text-emerald-400/90" role="status">
                Güncellendi
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-white/10 bg-[#121215] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveView("genel")}
              className={`rounded-xl border px-3 py-2 text-xs font-black uppercase transition-colors ${
                activeView === "genel"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              Genel
            </button>
            <button
              type="button"
              onClick={() => setActiveView("coach-payout-items")}
              className={`rounded-xl border px-3 py-2 text-xs font-black uppercase transition-colors ${
                activeView === "coach-payout-items"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              Koç Ödeme Kalemleri
            </button>
          </div>
          <p className="text-xs font-semibold text-gray-500">
            {activeView === "genel" ? "Tahsilat ve ders özetleri" : "Koç ödemesine aday ders takibi"}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            Tahsilat Ekle
          </button>
          <button
            type="button"
            onClick={openCoachPayoutFlow}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-400/45 bg-indigo-500/10 px-4 text-xs font-black uppercase tracking-wide text-indigo-100 transition hover:border-indigo-300/60 hover:bg-indigo-500/20"
            aria-label="Koç ödeme kalemleri sekmesine geç"
          >
            Koç ödeme süreci
          </button>
          <button
            type="button"
            onClick={() => setShowRuleModal(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-xs font-black uppercase tracking-wide text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
          >
            Koç ödeme kuralı
          </button>
        </div>
      </section>

      {loadError ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3">
          <Notification message={loadError} variant="error" />
          <p className="mt-2 text-[11px] font-semibold text-red-200/90">
            Tekrar denemek için üstteki <span className="font-black uppercase text-white">Yenile</span> düğmesini kullanın.
          </p>
        </div>
      ) : null}
      {snapshot?.compatibilityNotice ? (
        <p className="text-[11px] font-semibold text-amber-100/85">
          Bazı eski kayıtlar farklı formatta olabilir; sistem otomatik uyum sağlar.
        </p>
      ) : null}
      {actionFeedback ? <Notification message={actionFeedback.message} variant={actionFeedback.type} /> : null}

      {activeView === "genel" ? (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase text-white">Filtreler</h2>
            <span className="text-[10px] font-semibold text-gray-500">Önce ay; diğerleri isteğe bağlı</span>
          </div>
          <p className="mb-2 text-[10px] font-semibold text-gray-500" title="Dönem ve tarih aralığı Türkiye saatine göre">
            Tarih aralığı Türkiye saatine göre filtrelenir.
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 space-y-1 lg:max-w-md">
              <span className="text-[10px] font-black uppercase text-gray-500">Ay (öncelikli)</span>
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
                className="ui-input min-h-11 w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersAdvancedOpen((o) => !o)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 text-xs font-black uppercase text-gray-300 transition hover:border-white/25 hover:text-white"
            >
              {filtersAdvancedOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
              Gelişmiş filtreler
            </button>
          </div>
          {filtersAdvancedOpen ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Tarih başlangıç</span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="ui-input min-h-11 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Tarih bitiş</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="ui-input min-h-11 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Koç</span>
                <select
                  value={filters.coachId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, coachId: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  <option value="">Tüm koçlar</option>
                  {(snapshot?.options.coaches || []).map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Ders tipi</span>
                <select
                  value={filters.lessonType}
                  onChange={(e) => setFilters((prev) => ({ ...prev, lessonType: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {LESSON_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Ders durumu</span>
                <select
                  value={filters.lessonStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, lessonStatus: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {LESSON_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Ödeme türü</span>
                <select
                  value={filters.paymentKind}
                  onChange={(e) => setFilters((prev) => ({ ...prev, paymentKind: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  <option value="">Tüm ödeme türleri</option>
                  {paymentKindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {getAccountingPaymentKindLabel(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2 xl:col-span-3">
                <span className="text-[10px] font-black uppercase text-gray-500">Tahsilat durumu</span>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {filtersAdvancedOpen || filters.dateFrom || filters.dateTo ? (
            <p className="mt-3 text-[11px] font-semibold text-amber-300/90">
              Özel tarih aralığı doluysa ay filtresi yok sayılır.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[#121215] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase text-white">Filtreler</h2>
            <span className="text-[10px] font-semibold text-gray-500">Önce ay; diğerleri isteğe bağlı</span>
          </div>
          <p className="mb-2 text-[10px] font-semibold text-gray-500" title="Dönem ve tarih aralığı Türkiye saatine göre">
            Tarih aralığı Türkiye saatine göre filtrelenir.
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 space-y-1 lg:max-w-md">
              <span className="text-[10px] font-black uppercase text-gray-500">Ay (öncelikli)</span>
              <input
                type="month"
                value={coachPayoutFilters.month}
                onChange={(e) => setCoachPayoutFilters((prev) => ({ ...prev, month: e.target.value }))}
                className="ui-input min-h-11 w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => setCoachPayoutFiltersAdvancedOpen((o) => !o)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 text-xs font-black uppercase text-gray-300 transition hover:border-white/25 hover:text-white"
            >
              {coachPayoutFiltersAdvancedOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
              Gelişmiş filtreler
            </button>
          </div>
          {coachPayoutFiltersAdvancedOpen ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Tarih başlangıç</span>
                <input
                  type="date"
                  value={coachPayoutFilters.dateFrom}
                  onChange={(e) => setCoachPayoutFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="ui-input min-h-11 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Tarih bitiş</span>
                <input
                  type="date"
                  value={coachPayoutFilters.dateTo}
                  onChange={(e) => setCoachPayoutFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="ui-input min-h-11 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Koç</span>
                <select
                  value={coachPayoutFilters.coachId}
                  onChange={(e) => setCoachPayoutFilters((prev) => ({ ...prev, coachId: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  <option value="">Tüm koçlar</option>
                  {(snapshot?.options.coaches || []).map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Ders tipi</span>
                <select
                  value={coachPayoutFilters.lessonType}
                  onChange={(e) => setCoachPayoutFilters((prev) => ({ ...prev, lessonType: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {LESSON_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-[10px] font-black uppercase text-gray-500">Koç ödeme durumu</span>
                <select
                  value={coachPayoutFilters.payoutStatus}
                  onChange={(e) => setCoachPayoutFilters((prev) => ({ ...prev, payoutStatus: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {PAYOUT_TRACKING_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {coachPayoutFiltersAdvancedOpen || coachPayoutFilters.dateFrom || coachPayoutFilters.dateTo ? (
            <p className="mt-3 text-[11px] font-semibold text-amber-300/90">
              Özel tarih aralığı doluysa ay filtresi yok sayılır.
            </p>
          ) : null}
        </section>
      )}

      {activeView === "genel" ? (
        <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5"
              title="Seçili dönemde tahsil edilmiş tutar (ödendi)"
            >
              <p className="text-[9px] font-black uppercase text-emerald-200/80">Toplam tahsilat</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-300">{formatMoney(snapshot?.kpis.totalCollected || 0)}</p>
            </article>
            <article
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5"
              title="Bekleyen / kısmi tahsilat tutarı"
            >
              <p className="text-[9px] font-black uppercase text-amber-200/80">Bekleyen tahsilat</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-amber-300">{formatMoney(snapshot?.kpis.pendingCollection || 0)}</p>
            </article>
            <article
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5"
              title="Tamamlanan, listeye alınmamış koç ödeme adayı ders sayısı"
            >
              <p className="text-[9px] font-black uppercase text-gray-400">Koç ödeme bekleyen ders</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-amber-200">
                {(snapshot?.kpis.payoutPendingCount || 0).toLocaleString("tr-TR")}
              </p>
            </article>
            <article
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5"
              title="Koç ödemesi tamamlanan ders sayısı"
            >
              <p className="text-[9px] font-black uppercase text-gray-400">Ödenen koç kalemi</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">
                {(snapshot?.kpis.payoutPaidCount || 0).toLocaleString("tr-TR")}
              </p>
            </article>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-gray-500">Seçili dönem · Filtrelenmiş veriler</p>
          <DataSourceHint className="mt-1" />
        </section>
      ) : (
        <section className="space-y-3 rounded-xl border border-white/10 bg-[#121215] p-4">
          <CoachPayoutFlowMini />
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-lg border border-amber-500/15 bg-black/20 px-3 py-2" title="Listede bekleyen tamamlanan dersler">
              <p className="text-[9px] font-black uppercase text-gray-500">Bekleyen</p>
              <p className="text-xl font-black tabular-nums text-amber-300">{coachPayoutKpis.pending.toLocaleString("tr-TR")}</p>
            </article>
            <article className="rounded-lg border border-indigo-500/15 bg-black/20 px-3 py-2">
              <p className="text-[9px] font-black uppercase text-gray-500">Listeye alınan</p>
              <p className="text-xl font-black tabular-nums text-indigo-300">{coachPayoutKpis.included.toLocaleString("tr-TR")}</p>
            </article>
            <article className="rounded-lg border border-emerald-500/15 bg-black/20 px-3 py-2">
              <p className="text-[9px] font-black uppercase text-gray-500">Ödenen</p>
              <p className="text-xl font-black tabular-nums text-emerald-300">{coachPayoutKpis.paid.toLocaleString("tr-TR")}</p>
            </article>
          </div>
          <p className="text-[11px] font-semibold text-gray-400">
            Toplam koç payı (filtreli liste):{" "}
            <span className="font-black text-cyan-300">{formatMoney(coachPayoutKpis.amountTotal)}</span>
            <span className="text-gray-600"> · </span>
            Bekleyen: <span className="text-amber-200">{formatMoney(coachPayoutKpis.amountPending)}</span>
            <span className="text-gray-600"> · </span>
            Ödenen: <span className="text-emerald-200">{formatMoney(coachPayoutKpis.amountPaid)}</span>
          </p>
          <p className="text-[10px] font-semibold text-gray-500">Seçili dönem · Filtrelenmiş veriler</p>
          <DataSourceHint />
        </section>
      )}

      {activeView === "genel" ? (
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-black uppercase text-white">Tahsilat Kayıtları</h2>
          <p className="text-[11px] font-semibold text-gray-500">{snapshot?.payments?.length ?? 0} kayıt</p>
        </div>
        <DataSourceHint />
        <div className="space-y-3 md:hidden">
          {(snapshot?.payments || []).map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/10 bg-[#121215] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{row.athleteName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-500">
                    {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("tr-TR") : "-"}
                  </p>
                </div>
                <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getPaymentStatusBadgeClass(row.status)}`}>
                  {getAccountingPaymentStatusLabel(row.status)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold">
                <p className="text-gray-400">Tür: <span className="text-gray-200">{getAccountingPaymentKindLabel(row.paymentKind)}</span></p>
                <p className="text-right text-emerald-300">{formatMoney(row.amount)}</p>
                <p className="col-span-2 text-gray-400">Kaynak: <span className="text-gray-300">{row.sourceLabel || "-"}</span></p>
              </div>
            </article>
          ))}
          {(snapshot?.payments?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs font-bold uppercase text-gray-400">Bu aralıkta kayıt yok</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Filtreleri değiştirerek kontrol edebilirsiniz. İsterseniz yeni tahsilat da ekleyebilirsiniz.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase text-black hover:bg-emerald-400"
                >
                  Tahsilat ekle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetGeneralFilters();
                    setFiltersAdvancedOpen(true);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                >
                  Filtreleri sıfırla
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#121215] md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Sporcu</th>
                <th className="px-3 py-2">Tür</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-3 py-2">Ödeme tarihi</th>
                <th className="px-3 py-2">Kaynak / Açıklama</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.payments || []).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 text-xs text-gray-200 transition-colors hover:bg-white/[0.04]"
                >
                  <td className="px-3 py-2">{row.athleteName}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-300">
                      {getAccountingPaymentKindLabel(row.paymentKind)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{formatMoney(row.amount)}</td>
                  <td className="px-3 py-2">{row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("tr-TR") : "-"}</td>
                  <td className="px-3 py-2">{row.sourceLabel}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getPaymentStatusBadgeClass(row.status)}`}>
                      {getAccountingPaymentStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {(snapshot?.payments?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center">
                    <p className="text-xs font-bold uppercase text-gray-400">Bu aralıkta kayıt yok</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      Filtreleri değiştirerek kontrol edebilirsiniz. İsterseniz yeni tahsilat da ekleyebilirsiniz.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase text-black hover:bg-emerald-400"
                      >
                        Tahsilat ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetGeneralFilters();
                          setFiltersAdvancedOpen(true);
                        }}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                      >
                        Filtreleri sıfırla
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section className="space-y-3">
        <div ref={recordsSectionRef} />
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-black uppercase text-white">
            {activeView === "genel" ? "Ders & Koç Ödeme Listesi" : "Koç Ödeme Kalemleri"}
          </h2>
          <p className="text-[11px] font-semibold text-gray-500">
            {lessonRows.length} kayıt
          </p>
        </div>
        <DataSourceHint />
        <div className="space-y-3 md:hidden">
          {lessonRows.map((row) => (
            <article
              key={`mobile-${row.sourceType}-${row.id}`}
              className={`rounded-2xl border bg-[#121215] p-4 ${
                activeView === "coach-payout-items" && coachPayoutSectionHighlight
                  ? "border-indigo-400/60 ring-1 ring-indigo-400/35"
                  : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{row.title}</p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-500">{formatShortDateTime(row.startsAt)}</p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getPayoutStatusBadgeClass(
                    row.payoutStatus,
                    row.coachPayoutEligible
                  )}`}
                >
                  {row.calculationStatus === "no_rule" && row.coachPayoutEligible
                    ? "Kural Tanımsız"
                    : getAccountingCoachPayoutTrackingLabel(row.payoutStatus, row.coachPayoutEligible)}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-[11px] font-semibold">
                <p className="text-gray-400">
                  {getAccountingLessonTypeLabel(row.sourceType)} · {getAccountingLessonStatusLabel(row.status)}
                </p>
                <p className="text-gray-400">Koç: <span className="text-gray-200">{row.coachName}</span></p>
                <p className="text-gray-400">Lokasyon: <span className="text-gray-200">{row.location || "-"}</span></p>
                <p className="text-gray-400">
                  Ders Ücreti: <span className="text-gray-200">{row.lessonPrice != null ? formatMoney(row.lessonPrice) : "-"}</span>
                </p>
                <p className="text-cyan-300">Koç Payı: {formatMoney(row.payoutAmount || 0)}</p>
              </div>
              {snapshot?.canManagePayouts && row.coachPayoutEligible ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.calculationStatus === "no_rule" ? (
                    <span className="text-[11px] font-semibold text-amber-300" title="Ödeme kuralı tanımlanmadan işleme alınamaz.">
                      Kural Tanımsız
                    </span>
                  ) : row.payoutStatus === "paid" ? (
                    <span className="text-[11px] font-semibold text-emerald-300">Tamamlandı</span>
                  ) : row.payoutStatus === "included" ? (
                    <button
                      type="button"
                      onClick={() => row.payoutItemId && void handleMarkPaid(row.payoutItemId)}
                      disabled={rowActionBusyKey === `paid-${row.payoutItemId}`}
                      className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 text-[11px] font-bold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Koç Ödemesi Tamamlandı
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleAddPayout(row)}
                      disabled={rowActionBusyKey === `include-${row.payoutSourceType}-${row.id}`}
                      className="rounded-lg border border-indigo-500/50 bg-indigo-500/20 px-3 py-2 text-[11px] font-bold text-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Listeye al
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
          {lessonsEmpty ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs font-bold uppercase text-gray-400">Bu aralıkta kayıt yok</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Filtreleri değiştirerek kontrol edebilirsiniz.
                {activeView === "genel"
                  ? " Ayı veya gelişmiş filtreleri gözden geçirebilirsiniz."
                  : " Tamamlanan dersler ödeme adayıdır; filtreleri gevşetmeyi deneyin."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {activeView === "genel" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        resetGeneralFilters();
                        setFiltersAdvancedOpen(true);
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                    >
                      Filtreleri sıfırla
                    </button>
                    <button
                      type="button"
                      onClick={goToTrainingManagement}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 text-xs font-black uppercase text-indigo-100 hover:bg-indigo-500/25"
                    >
                      Ders yönetimine git
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        resetCoachPayoutFilters();
                        setCoachPayoutFiltersAdvancedOpen(true);
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                    >
                      Filtreleri sıfırla
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRuleModal(true)}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 text-xs font-black uppercase text-indigo-100 hover:bg-indigo-500/25"
                    >
                      Koç ödeme kuralı
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div
          className={`hidden overflow-x-auto rounded-2xl border bg-[#121215] transition-all duration-700 md:block ${
            activeView === "coach-payout-items" && coachPayoutSectionHighlight
              ? "border-indigo-400/50 ring-1 ring-indigo-400/30"
              : "border-white/10"
          }`}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
              <tr>
                {activeView === "coach-payout-items" ? <th className="px-3 py-2">Koç</th> : null}
                <th className="px-3 py-2">Ders</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Tarih & Saat</th>
                {activeView === "genel" ? <th className="px-3 py-2">Koç</th> : null}
                <th className="px-3 py-2">Lokasyon</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Katılımcı</th>
                <th className="px-3 py-2 text-right">Ders Ücreti</th>
                <th className="px-3 py-2 text-right">Koç Payı</th>
                <th className="px-3 py-2">Hesaplama Durumu</th>
                <th className="px-3 py-2">Koç ödeme adayı</th>
                <th className="px-3 py-2">Koç ödeme durumu</th>
                <th className="px-3 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {lessonRows.map((row) => (
                <tr
                  key={`${row.sourceType}-${row.id}`}
                  className="border-b border-white/5 text-xs text-gray-200 transition-colors hover:bg-white/[0.04]"
                >
                  {activeView === "coach-payout-items" ? <td className="px-3 py-2">{row.coachName}</td> : null}
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{getAccountingLessonTypeLabel(row.sourceType)}</td>
                  <td className="px-3 py-2">{formatShortDateTime(row.startsAt)}</td>
                  {activeView === "genel" ? <td className="px-3 py-2">{row.coachName}</td> : null}
                  <td className="px-3 py-2">{row.location || "-"}</td>
                  <td className="px-3 py-2">{getAccountingLessonStatusLabel(row.status)}</td>
                  <td className="px-3 py-2">{row.participantCount}</td>
                  <td className="px-3 py-2 text-right">{row.lessonPrice != null ? formatMoney(row.lessonPrice) : "-"}</td>
                  <td className="px-3 py-2 text-right font-bold">{formatMoney(row.payoutAmount || 0)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getCalculationBadgeClass(row.calculationStatus)}`}>
                      {getAccountingPayoutCalculationLabel(row.calculationStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.coachPayoutEligible ? "Evet" : "Hayır"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getPayoutStatusBadgeClass(
                        row.payoutStatus,
                        row.coachPayoutEligible
                      )}`}
                    >
                      {row.calculationStatus === "no_rule" && row.coachPayoutEligible
                        ? "Kural Tanımsız"
                        : getAccountingCoachPayoutTrackingLabel(row.payoutStatus, row.coachPayoutEligible)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {snapshot?.canManagePayouts && row.coachPayoutEligible ? (
                      <div className="flex flex-wrap gap-2">
                        {row.calculationStatus === "no_rule" ? (
                          <span className="text-[11px] font-semibold text-amber-300" title="Ödeme kuralı tanımlanmadan işleme alınamaz.">
                            Kural Tanımsız
                          </span>
                        ) : row.payoutStatus === "paid" ? (
                          <span className="text-[11px] font-semibold text-emerald-300">Tamamlandı</span>
                        ) : row.payoutStatus === "included" ? (
                          <button
                            type="button"
                            onClick={() => row.payoutItemId && void handleMarkPaid(row.payoutItemId)}
                            disabled={rowActionBusyKey === `paid-${row.payoutItemId}`}
                            className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 text-[11px] font-bold text-emerald-100 shadow-sm shadow-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Ödeme listesine alınan dersi ödendi olarak işaretler."
                          >
                            Koç Ödemesi Tamamlandı
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleAddPayout(row)}
                            disabled={rowActionBusyKey === `include-${row.payoutSourceType}-${row.id}`}
                            className="rounded-lg border border-indigo-500/50 bg-indigo-500/20 px-3 py-2 text-[11px] font-bold text-indigo-100 shadow-sm shadow-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Tamamlanan dersi koç ödeme listesine ekler."
                          >
                            Listeye al
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {lessonsEmpty ? (
                <tr>
                  <td colSpan={activeView === "genel" ? 13 : 14} className="px-3 py-10 text-center">
                    {activeView === "genel" ? (
                      <>
                        <p className="text-xs font-bold uppercase text-gray-400">Bu aralıkta kayıt yok</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          Filtreleri değiştirerek kontrol edebilirsiniz. Ayı veya gelişmiş filtreleri gözden geçirebilirsiniz.
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetGeneralFilters();
                              setFiltersAdvancedOpen(true);
                            }}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                          >
                            Filtreleri sıfırla
                          </button>
                          <button
                            type="button"
                            onClick={goToTrainingManagement}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 text-xs font-black uppercase text-indigo-100 hover:bg-indigo-500/25"
                          >
                            Ders yönetimine git
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPaymentModal(true)}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase text-black hover:bg-emerald-400"
                          >
                            Tahsilat ekle
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold uppercase text-gray-400">Bu aralıkta kayıt yok</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          Filtreleri değiştirerek kontrol edebilirsiniz. Tamamlanan dersler ödeme adayıdır; filtreleri gevşetmeyi deneyin.
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetCoachPayoutFilters();
                              setCoachPayoutFiltersAdvancedOpen(true);
                            }}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                          >
                            Filtreleri sıfırla
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRuleModal(true)}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 text-xs font-black uppercase text-indigo-100 hover:bg-indigo-500/25"
                          >
                            Koç ödeme kuralı
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showRuleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6">
          <div
            className="max-h-[min(90dvh,880px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101013] shadow-2xl shadow-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rule-modal-title"
          >
            <div className="border-b border-white/10 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="rule-modal-title" className="text-base font-black uppercase tracking-wide text-white">
                    Koç ödeme kuralları
                  </h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Ders başı veya yüzde; tablo hesapları buna bağlanır.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5"
                >
                  Kapat
                </button>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-gray-500">Koç</span>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={ruleForm.coachId}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, coachId: e.target.value }))}
                  >
                    <option value="">Koç seçin</option>
                    {(snapshot?.options.coaches || []).map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-gray-500">Ders kapsamı</span>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={ruleForm.appliesTo}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, appliesTo: e.target.value }))}
                  >
                    <option value="all">Tümü</option>
                    <option value="group">Grup</option>
                    <option value="private">Özel</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-gray-500">Ödeme tipi</span>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={ruleForm.paymentType}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                  >
                    <option value="per_lesson">Ders başı sabit (TL)</option>
                    <option value="percentage">Yüzde (ders ücretinden pay)</option>
                  </select>
                </label>
                <p className="sm:col-span-2 -mt-1 text-[11px] font-semibold text-gray-500">
                  {ruleForm.paymentType === "per_lesson"
                    ? "Seçili kural, her uygun ders için sabit tutar uygular."
                    : "Seçili kural, ders ücretinin belirli yüzdesini uygular."}
                </p>
                {ruleForm.paymentType === "per_lesson" ? (
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[10px] font-black uppercase text-gray-500">Tutar (₺)</span>
                    <input
                      type="number"
                      min={0}
                      className="ui-input min-h-11 w-full"
                      value={ruleForm.amount}
                      onChange={(e) => setRuleForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[10px] font-black uppercase text-gray-500">Yüzde (0–100)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="ui-input min-h-11 w-full"
                      value={ruleForm.percentage}
                      onChange={(e) => setRuleForm((prev) => ({ ...prev, percentage: e.target.value }))}
                    />
                  </label>
                )}
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handleRuleSubmit()}
                  disabled={ruleSubmitDisabled}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {ruleSubmitting ? "Kaydediliyor..." : "Kuralı kaydet"}
                </button>
              </div>
            </div>
            <div className="border-t border-white/10 bg-black/20 p-5 sm:p-6">
              <p className="mb-3 text-[10px] font-black uppercase text-gray-400">Mevcut kurallar</p>
              {rulesLoading ? (
                <p className="text-xs font-semibold text-gray-500">Yükleniyor...</p>
              ) : rules.length === 0 ? (
                <p className="text-xs font-semibold text-gray-500">Henüz ödeme kuralı tanımlanmadı. Bir koç seçerek başlayın.</p>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => {
                    const coachName = (snapshot?.options.coaches || []).find((c) => c.id === rule.coach_id)?.full_name || "Koç";
                    return (
                      <div key={rule.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{coachName}</span>
                        <span>{rule.applies_to === "all" ? "Tümü" : rule.applies_to === "group" ? "Grup" : "Özel"}</span>
                        <span>·</span>
                        <span>{rule.payment_type === "per_lesson" ? `Sabit ₺${Number(rule.amount || 0).toLocaleString("tr-TR")}` : `%${Number(rule.percentage || 0).toLocaleString("tr-TR")}`}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showPaymentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6">
          <div
            className="max-h-[min(90dvh,800px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101013] shadow-2xl shadow-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
          >
            <div className="border-b border-white/10 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="payment-modal-title" className="text-base font-black uppercase tracking-wide text-white">
                    Tahsilat ekle
                  </h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Kayıt tahsilat tablosuna düşer.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5"
                >
                  Kapat
                </button>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-gray-500">Sporcu</span>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={paymentForm.profileId}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, profileId: e.target.value }))}
                  >
                    <option value="">Sporcu seçin</option>
                    {(snapshot?.options.athletes || []).map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        {athlete.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-gray-500">Tutar (₺)</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₺</span>
                    <input
                      type="number"
                      min={0}
                      className="ui-input min-h-11 w-full pl-8"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-gray-500">Ödeme tarihi</span>
                  <input
                    type="date"
                    className="ui-input min-h-11 w-full"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-gray-500">Ödeme türü</span>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={paymentForm.paymentKind}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentKind: e.target.value }))}
                  >
                    {PAYMENT_KIND_FORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {paymentForm.paymentKind === "private_lesson_package" ? (
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[10px] font-black uppercase text-gray-500">Paket ID (opsiyonel)</span>
                    <input
                      type="text"
                      className="ui-input min-h-11 w-full font-mono text-xs"
                      value={paymentForm.packageId}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, packageId: e.target.value }))}
                      placeholder="UUID"
                    />
                  </label>
                ) : null}
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-gray-500">Açıklama</span>
                  <textarea
                    className="ui-textarea min-h-[4rem] w-full"
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handlePaymentSubmit()}
                  disabled={paymentSubmitDisabled}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-8 text-sm font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {paymentSubmitting ? "Kaydediliyor..." : "Tahsilatı kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
