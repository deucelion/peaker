"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Notification from "@/components/Notification";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import {
  loadAccountingFinanceDashboard,
  createAccountingPayment,
  listPrivateLessonPackagesForAccounting,
  type AccountingFinanceSnapshot,
  type AccountingFinanceFilters,
  type AccountingFinancePackageOption,
} from "@/lib/actions/accountingFinanceActions";
import {
  getAccountingLessonStatusLabel,
  getAccountingLessonTypeLabel,
  getAccountingPaymentKindLabel,
  getAccountingPaymentStatusLabel,
} from "@/lib/accountingFinance/labels";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";

type ViewTab = "genel" | "koclar";

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

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getPaymentStatusBadgeClass(status: "bekliyor" | "odendi") {
  return status === "odendi"
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/35 bg-amber-500/10 text-amber-200";
}

function lessonStatusBadgeClass(status: string) {
  if (status === "completed") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (status === "cancelled") return "border-red-500/35 bg-red-500/10 text-red-200";
  return "border-white/15 bg-white/5 text-gray-300";
}

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatPackageDropdownLabel(pkg: AccountingFinancePackageOption) {
  const remainingPay = normalizeMoney(pkg.totalPrice - pkg.amountPaid);
  const paidLabel =
    pkg.paymentStatus === "paid"
      ? "Ödeme tamam"
      : pkg.paymentStatus === "partial"
        ? "Kısmi ödeme"
        : "Ödeme bekliyor";
  return `${pkg.packageName} · Kalan ${pkg.remainingLessons} ders · Kalan ₺${remainingPay.toLocaleString("tr-TR")} (${paidLabel})`;
}

function readOrgFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("org");
}

export default function MuhasebeFinansPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AccountingFinanceSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewTab>("genel");
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

  const [coachesFilters, setCoachesFilters] = useState({
    month: monthKeyNow(),
    dateFrom: "",
    dateTo: "",
    coachId: "",
    lessonType: "all",
    lessonStatus: "all",
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    profileId: "",
    amount: "",
    paymentKind: "monthly_membership",
    paymentDate: new Date().toISOString().slice(0, 10),
    description: "",
    packageId: "",
  });
  const [packageOptions, setPackageOptions] = useState<AccountingFinancePackageOption[]>([]);
  const [packageOptionsLoading, setPackageOptionsLoading] = useState(false);
  const [packageOptionsError, setPackageOptionsError] = useState<string | null>(null);
  const paymentSubmitInFlightRef = useRef(false);

  const [filtersAdvancedOpen, setFiltersAdvancedOpen] = useState(false);
  const [coachesFiltersAdvancedOpen, setCoachesFiltersAdvancedOpen] = useState(false);
  const [canOpenAthletePayments, setCanOpenAthletePayments] = useState(false);
  const [refreshAck, setRefreshAck] = useState(false);

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

  const resetCoachesFilters = useCallback(() => {
    setActionFeedback(null);
    setCoachesFilters({
      month: monthKeyNow(),
      dateFrom: "",
      dateTo: "",
      coachId: "",
      lessonType: "all",
      lessonStatus: "all",
    });
    setCoachesFiltersAdvancedOpen(false);
  }, []);

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    const cf = activeView === "genel" ? filters : coachesFilters;
    const payload: AccountingFinanceFilters = {
      orgId: readOrgFromUrl(),
      month: cf.month,
      dateFrom: cf.dateFrom || undefined,
      dateTo: cf.dateTo || undefined,
      coachId: cf.coachId || undefined,
      lessonType: cf.lessonType as AccountingFinanceFilters["lessonType"],
      lessonStatus: cf.lessonStatus as AccountingFinanceFilters["lessonStatus"],
      paymentKind: activeView === "genel" ? filters.paymentKind || undefined : undefined,
      paymentStatus:
        activeView === "genel" ? (filters.paymentStatus as AccountingFinanceFilters["paymentStatus"]) : "all",
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
  }, [activeView, coachesFilters, filters]);

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

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

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

  useEffect(() => {
    if (!showPaymentModal || paymentForm.paymentKind !== "private_lesson_package" || !paymentForm.profileId) {
      const resetId = window.setTimeout(() => {
        setPackageOptions([]);
        setPackageOptionsError(null);
        setPackageOptionsLoading(false);
      }, 0);
      return () => clearTimeout(resetId);
    }
    let cancelled = false;
    const loadId = window.setTimeout(() => {
      setPackageOptionsLoading(true);
      setPackageOptionsError(null);
    }, 0);
    void (async () => {
      await new Promise((r) => setTimeout(r, 0));
      if (cancelled) return;
      const res = await listPrivateLessonPackagesForAccounting({
        athleteId: paymentForm.profileId,
        organizationId: readOrgFromUrl(),
      });
      if (cancelled) return;
      setPackageOptionsLoading(false);
      if ("error" in res) {
        setPackageOptions([]);
        setPackageOptionsError(res.error);
        return;
      }
      setPackageOptions(res.packages);
    })();
    return () => {
      cancelled = true;
      clearTimeout(loadId);
    };
  }, [showPaymentModal, paymentForm.paymentKind, paymentForm.profileId]);

  const paymentKindOptions = useMemo(() => snapshot?.options.paymentKinds || [], [snapshot]);
  const periodLabel = useMemo(
    () => formatMonthLabel(activeView === "genel" ? filters.month : coachesFilters.month),
    [activeView, coachesFilters.month, filters.month]
  );

  const lessons = snapshot?.lessons || [];
  const lessonsEmpty = lessons.length === 0;

  const paymentAmountValue = Number(paymentForm.amount || "0");
  const packageKindRequiresSelection = paymentForm.paymentKind === "private_lesson_package";
  const paymentSubmitDisabled =
    paymentSubmitting ||
    !paymentForm.profileId ||
    !Number.isFinite(paymentAmountValue) ||
    paymentAmountValue <= 0 ||
    !paymentForm.paymentDate ||
    (packageKindRequiresSelection && !paymentForm.packageId);

  const handlePaymentSubmit = useCallback(async () => {
    if (paymentSubmitInFlightRef.current) return;
    if (
      !paymentForm.profileId ||
      !Number.isFinite(paymentAmountValue) ||
      paymentAmountValue <= 0 ||
      !paymentForm.paymentDate ||
      (packageKindRequiresSelection && !paymentForm.packageId)
    ) {
      return;
    }
    paymentSubmitInFlightRef.current = true;
    setPaymentSubmitting(true);
    try {
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
        return;
      }
      setActionFeedback({ type: "success", message: "Tahsilat kaydı başarıyla eklendi." });
      await refreshDashboardHard();
      setShowPaymentModal(false);
      setPaymentForm({
        profileId: "",
        amount: "",
        paymentKind: "monthly_membership",
        paymentDate: new Date().toISOString().slice(0, 10),
        description: "",
        packageId: "",
      });
    } finally {
      paymentSubmitInFlightRef.current = false;
      setPaymentSubmitting(false);
    }
  }, [paymentForm, refreshDashboardHard, packageKindRequiresSelection, paymentAmountValue]);

  if (loading && !snapshot && !loadError) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center text-green-500">
        <Loader2 className="size-10 animate-spin" aria-hidden />
      </div>
    );
  }

  const kpis = snapshot?.kpis;

  return (
    <div className="ui-page-loose space-y-5 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121215] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="ui-h1">
            Muhasebe & <span className="text-green-500">Finans</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Tahsilat ve ders kayıtlarını tek ekrandan takip edin.
            {canOpenAthletePayments ? (
              <>
                {" "}
                Sporcu bazlı özet için{" "}
                <button type="button" onClick={() => router.push("/finans")} className="text-emerald-400 underline-offset-2 hover:underline">
                  Sporcu ödemeleri
                </button>
                .
              </>
            ) : null}
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
              onClick={() => setActiveView("koclar")}
              className={`rounded-xl border px-3 py-2 text-xs font-black uppercase transition-colors ${
                activeView === "koclar"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              Koçlar
            </button>
          </div>
          <p className="text-xs font-semibold text-gray-500">
            {activeView === "genel" ? "Tahsilat + ders kayıtları" : "Koç ders aktivitesi"}
          </p>
        </div>

        {activeView === "genel" ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => {
                setPaymentForm({
                  profileId: "",
                  amount: "",
                  paymentKind: "monthly_membership",
                  paymentDate: new Date().toISOString().slice(0, 10),
                  description: "",
                  packageId: "",
                });
                setShowPaymentModal(true);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Tahsilat Ekle
            </button>
          </div>
        ) : null}
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
        <p className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-100/90">
          <span aria-hidden>ⓘ</span>
          Eski tahsilat kayıtları farklı formatta olabilir; liste yine gösterilir.
        </p>
      ) : null}
      {actionFeedback ? <Notification message={actionFeedback.message} variant={actionFeedback.type} /> : null}

      {activeView === "genel" ? (
        <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase text-white">Filtreler</h2>
          </div>
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
          <p className="mt-3 text-[10px] font-medium text-gray-500">Veriler seçili döneme ve filtrelere göre güncellenir.</p>
        </section>
      ) : (
        <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase text-white">Filtreler</h2>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 space-y-1 lg:max-w-md">
              <span className="text-[10px] font-black uppercase text-gray-500">Ay (öncelikli)</span>
              <input
                type="month"
                value={coachesFilters.month}
                onChange={(e) => setCoachesFilters((prev) => ({ ...prev, month: e.target.value }))}
                className="ui-input min-h-11 w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => setCoachesFiltersAdvancedOpen((o) => !o)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 text-xs font-black uppercase text-gray-300 transition hover:border-white/25 hover:text-white"
            >
              {coachesFiltersAdvancedOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
              Gelişmiş filtreler
            </button>
          </div>
          {coachesFiltersAdvancedOpen ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Tarih başlangıç</span>
                <input
                  type="date"
                  value={coachesFilters.dateFrom}
                  onChange={(e) => setCoachesFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="ui-input min-h-11 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Tarih bitiş</span>
                <input
                  type="date"
                  value={coachesFilters.dateTo}
                  onChange={(e) => setCoachesFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="ui-input min-h-11 w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-500">Koç</span>
                <select
                  value={coachesFilters.coachId}
                  onChange={(e) => setCoachesFilters((prev) => ({ ...prev, coachId: e.target.value }))}
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
                  value={coachesFilters.lessonType}
                  onChange={(e) => setCoachesFilters((prev) => ({ ...prev, lessonType: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {LESSON_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2 xl:col-span-3">
                <span className="text-[10px] font-black uppercase text-gray-500">Ders durumu</span>
                <select
                  value={coachesFilters.lessonStatus}
                  onChange={(e) => setCoachesFilters((prev) => ({ ...prev, lessonStatus: e.target.value }))}
                  className="ui-select min-h-11 w-full"
                >
                  {LESSON_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {coachesFiltersAdvancedOpen || coachesFilters.dateFrom || coachesFilters.dateTo ? (
            <p className="mt-3 text-[11px] font-semibold text-amber-300/90">
              Özel tarih aralığı doluysa ay filtresi yok sayılır.
            </p>
          ) : null}
          <p className="mt-3 text-[10px] font-medium text-gray-500">Veriler seçili döneme ve filtrelere göre güncellenir.</p>
        </section>
      )}

      {activeView === "genel" ? (
        <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-emerald-200/80">Toplam tahsilat</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-300">{formatMoney(kpis?.totalCollected || 0)}</p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">Seçili dönemde alınan tahsilat</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-amber-200/80">Bekleyen tahsilat</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-amber-300">{formatMoney(kpis?.pendingCollection || 0)}</p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">Takip gerektiren bakiye</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-gray-400">Toplam ders</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-gray-100">{(kpis?.totalLessons ?? 0).toLocaleString("tr-TR")}</p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">Seçili dönemdeki tüm dersler</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-gray-400">Tamamlanan ders</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">
                {(kpis?.completedLessons ?? 0).toLocaleString("tr-TR")}
              </p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">Tamamlanan ders kayıtları</p>
            </article>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-gray-400">Toplam ders</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-gray-100">{(kpis?.totalLessons ?? 0).toLocaleString("tr-TR")}</p>
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
              <p className="mt-0.5 text-lg font-black tabular-nums text-gray-200">{(kpis?.plannedLessons ?? 0).toLocaleString("tr-TR")}</p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">Gelecek / açık dersler</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-gray-400">İptal</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-red-200">{(kpis?.cancelledLessons ?? 0).toLocaleString("tr-TR")}</p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">İptal edilen dersler</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase text-gray-400">Aktif koç</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-cyan-200">{(kpis?.activeCoachCount ?? 0).toLocaleString("tr-TR")}</p>
              <p className="mt-1 text-[10px] font-medium text-gray-500">Bu dönemde dersi olan koç</p>
            </article>
          </div>
        </section>
      )}

      {activeView === "genel" ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-black uppercase text-white">Tahsilat Kayıtları</h2>
            <p className="text-[11px] font-semibold text-gray-500">{snapshot?.payments?.length ?? 0} kayıt</p>
          </div>
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
                  <p className="text-gray-400">
                    Tür: <span className="text-gray-200">{getAccountingPaymentKindLabel(row.paymentKind)}</span>
                  </p>
                  <p className="text-right text-emerald-300">{formatMoney(row.amount)}</p>
                  <p className="col-span-2 text-gray-400">
                    Kaynak: <span className="text-gray-300">{row.sourceLabel || "-"}</span>
                  </p>
                </div>
              </article>
            ))}
            {(snapshot?.payments?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
                <p className="text-xs font-bold text-gray-200">Bu aralıkta tahsilat kaydı yok</p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Filtreleri değiştirebilir veya yeni tahsilat ekleyebilirsiniz.
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
                  <tr key={row.id} className="border-b border-white/5 text-xs text-gray-200 transition-colors hover:bg-white/[0.04]">
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
                      <p className="text-xs font-bold text-gray-200">Bu aralıkta tahsilat kaydı yok</p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        Filtreleri değiştirebilir veya yeni tahsilat ekleyebilirsiniz.
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

      {activeView === "koclar" ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-black uppercase text-white">Koç bazlı özet</h2>
            <p className="text-[11px] font-semibold text-gray-500">{snapshot?.coachAggregates?.length ?? 0} koç</p>
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#121215] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Koç</th>
                  <th className="px-3 py-2 text-right">Toplam</th>
                  <th className="px-3 py-2 text-right">Grup</th>
                  <th className="px-3 py-2 text-right">Özel</th>
                  <th className="px-3 py-2 text-right">Tamamlanan</th>
                  <th className="px-3 py-2 text-right">Planlanan</th>
                  <th className="px-3 py-2 text-right">İptal</th>
                  <th className="px-3 py-2">Son ders</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot?.coachAggregates || []).map((row) => (
                  <tr key={row.coachId || row.coachName} className="border-b border-white/5 text-xs text-gray-200 hover:bg-white/[0.04]">
                    <td className="px-3 py-2 font-semibold">{row.coachName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.total.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.groupCount.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.privateCount.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-200/90">{row.completedCount.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.plannedCount.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-200/90">{row.cancelledCount.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2">{formatShortDate(row.lastLessonAt)}</td>
                  </tr>
                ))}
                {(snapshot?.coachAggregates?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center">
                      <p className="text-xs font-bold text-gray-200">Bu filtrelerde koç ders kaydı yok</p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        Dönemi değiştirebilir veya ders kayıtlarını kontrol edebilirsiniz.
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {(snapshot?.coachAggregates || []).map((row) => (
              <article key={row.coachId || row.coachName} className="rounded-xl border border-white/10 bg-[#121215] p-3 text-xs">
                <p className="font-black text-white">{row.coachName}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Toplam {row.total} · Grup {row.groupCount} · Özel {row.privateCount}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Tamamlanan {row.completedCount} · Planlanan {row.plannedCount} · İptal {row.cancelledCount}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">Son ders: {formatShortDate(row.lastLessonAt)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-black uppercase text-white">{activeView === "genel" ? "Ders Listesi" : "Ders detayı"}</h2>
          <p className="text-[11px] font-semibold text-gray-500">{lessons.length} kayıt</p>
        </div>
        <div className="space-y-3 md:hidden">
          {lessons.map((row) => (
            <article key={`${row.sourceType}-${row.id}`} className="rounded-2xl border border-white/10 bg-[#121215] p-4">
              <p className="text-sm font-black text-white">{row.title}</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-500">{formatShortDateTime(row.startsAt)}</p>
              <div className="mt-3 space-y-1 text-[11px] font-semibold">
                <p className="text-gray-400">
                  {getAccountingLessonTypeLabel(row.sourceType)} ·{" "}
                  <span className={`inline-flex rounded-full border px-2 py-0.5 ${lessonStatusBadgeClass(row.status)}`}>
                    {getAccountingLessonStatusLabel(row.status)}
                  </span>
                </p>
                <p className="text-gray-400">
                  Koç: <span className="text-gray-200">{row.coachName}</span>
                </p>
                <p className="text-gray-400">
                  Lokasyon: <span className="text-gray-200">{row.location || "—"}</span>
                </p>
                <p className="text-gray-400">
                  Katılımcı: <span className="text-gray-200">{row.participantCount}</span>
                </p>
              </div>
            </article>
          ))}
          {lessonsEmpty ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs font-bold text-gray-200">Bu aralıkta ders kaydı yok</p>
              <p className="mt-1 text-xs font-medium text-gray-500">
                Filtreleri değiştirebilir veya ders yönetiminden ders oluşturabilirsiniz.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeView === "genel") {
                      resetGeneralFilters();
                      setFiltersAdvancedOpen(true);
                    } else {
                      resetCoachesFilters();
                      setCoachesFiltersAdvancedOpen(true);
                    }
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                >
                  Filtreleri sıfırla
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/haftalik-ders-programi")}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 text-xs font-black uppercase text-indigo-100 hover:bg-indigo-500/25"
                >
                  Ders yönetimi
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#121215] md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Ders</th>
                <th className="px-3 py-2">Tür</th>
                <th className="px-3 py-2">Tarih & Saat</th>
                <th className="px-3 py-2">Koç</th>
                <th className="px-3 py-2">Lokasyon</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2 text-right">Katılımcı</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((row) => (
                <tr key={`${row.sourceType}-${row.id}`} className="border-b border-white/5 text-xs text-gray-200 hover:bg-white/[0.04]">
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{getAccountingLessonTypeLabel(row.sourceType)}</td>
                  <td className="px-3 py-2">{formatShortDateTime(row.startsAt)}</td>
                  <td className="px-3 py-2">{row.coachName}</td>
                  <td className="px-3 py-2">{row.location || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${lessonStatusBadgeClass(row.status)}`}>
                      {getAccountingLessonStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.participantCount}</td>
                </tr>
              ))}
              {lessonsEmpty ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center">
                    <p className="text-xs font-bold text-gray-200">Bu aralıkta ders kaydı yok</p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      Filtreleri değiştirebilir veya ders yönetiminden ders oluşturabilirsiniz.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeView === "genel") {
                            resetGeneralFilters();
                            setFiltersAdvancedOpen(true);
                          } else {
                            resetCoachesFilters();
                            setCoachesFiltersAdvancedOpen(true);
                          }
                        }}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
                      >
                        Filtreleri sıfırla
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/haftalik-ders-programi")}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 text-xs font-black uppercase text-indigo-100 hover:bg-indigo-500/25"
                      >
                        Ders yönetimi
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

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
                  disabled={paymentSubmitting}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Kapat
                </button>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <fieldset
                disabled={paymentSubmitting}
                className="min-w-0 space-y-5 border-0 p-0 disabled:pointer-events-none disabled:opacity-55"
              >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-gray-500">Sporcu</span>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={paymentForm.profileId}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, profileId: e.target.value, packageId: "" }))}
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
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentKind: e.target.value,
                        packageId: "",
                      }))
                    }
                  >
                    {PAYMENT_KIND_FORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {paymentForm.paymentKind === "private_lesson_package" ? (
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[10px] font-black uppercase text-gray-500">Paket seç</span>
                    {!paymentForm.profileId ? (
                      <>
                        <select disabled className="ui-select min-h-11 w-full cursor-not-allowed opacity-60">
                          <option>Önce sporcu seçin</option>
                        </select>
                        <p className="text-[11px] font-medium text-gray-500">Paket seçmek için önce sporcu seçin.</p>
                      </>
                    ) : packageOptionsLoading ? (
                      <p className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
                        <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                        Paketler yükleniyor…
                      </p>
                    ) : packageOptionsError ? (
                      <p className="text-[11px] font-medium text-red-300/90">{packageOptionsError}</p>
                    ) : packageOptions.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                        <p className="text-[11px] font-medium text-gray-400">Bu sporcu için aktif özel ders paketi bulunmuyor.</p>
                        <button
                          type="button"
                          onClick={() => router.push("/ozel-ders-paketleri")}
                          className="mt-2 text-[11px] font-bold text-emerald-400 underline-offset-2 hover:underline"
                        >
                          Özel ders paketlerine git
                        </button>
                      </div>
                    ) : (
                      <>
                        <select
                          className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                          value={paymentForm.packageId}
                          onChange={(e) => setPaymentForm((prev) => ({ ...prev, packageId: e.target.value }))}
                        >
                          <option value="">Paket seçin</option>
                          {packageOptions.map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {formatPackageDropdownLabel(pkg)}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] font-medium text-gray-500">
                          Toplam ücret ve kalan tutar seçilen pakete göre gösterilir; fazla tahsilat girilemez.
                        </p>
                      </>
                    )}
                  </div>
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
              </fieldset>
              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentSubmitting}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handlePaymentSubmit()}
                  disabled={paymentSubmitDisabled}
                  aria-busy={paymentSubmitting}
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
