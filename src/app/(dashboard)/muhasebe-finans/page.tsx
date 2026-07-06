"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonStatGrid, SkeletonTable } from "@/components/ui/skeletons";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import {
  type AccountingFinanceSnapshot,
  type AccountingFinanceFilters,
} from "@/lib/actions/accountingFinanceActions";
import { resolvePaymentsExportDateRange } from "@/lib/export/paymentsExportDateRange";
import { useStreamingCsvDownload } from "@/lib/hooks/useStreamingCsvDownload";
import { useAccountingFinanceDashboard } from "@/lib/hooks/useAccountingFinanceDashboard";
import { useFinanceRealtimeSync } from "@/lib/hooks/useFinanceRealtimeSync";
import { postFinanceTouch } from "@/lib/realtime/financeCrossTab";
import { formatRelativeTimeTr } from "@/lib/realtime/formatRelativeTimeTr";
import { LiveConnectionStrip, type LiveStatusTone } from "@/components/realtime/LiveStatusPrimitives";
import {
  getAccountingLessonStatusLabel,
  getAccountingLessonTypeLabel,
  getAccountingPaymentKindLabel,
  getAccountingPaymentStatusLabel,
} from "@/lib/accountingFinance/labels";
import {
  type CoachesFiltersState,
  type GeneralFiltersState,
  type ViewTab,
} from "./_components/types";
import { MuhasebeFilterBar } from "./_components/MuhasebeFilterBar";
import { MuhasebeKpiGridCoaches, MuhasebeKpiGridGeneral } from "./_components/MuhasebeKpiGrid";
import { MuhasebePaymentsTable } from "./_components/MuhasebePaymentsTable";
import { MuhasebeCoachesTable } from "./_components/MuhasebeCoachesTable";
import { MuhasebeLessonsTable } from "./_components/MuhasebeLessonsTable";
import { MuhasebePaymentModal } from "./_components/MuhasebePaymentModal";
import { MuhasebeReceivablesSection } from "./_components/MuhasebeReceivablesSection";

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

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const date = new Date(year || 0, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) return "Dönem seçilmedi";
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

/** `YYYY-MM-DD` (date input) → `DD.MM.YYYY` */
function formatWallDateInputTr(ymd: string) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function defaultGeneralFilters(): GeneralFiltersState {
  return {
    month: monthKeyNow(),
    dateFrom: "",
    dateTo: "",
    coachId: "",
    lessonType: "all",
    lessonStatus: "all",
    paymentKind: "",
    paymentStatus: "all",
    packageLifecycle: "all",
    packagePaymentState: "all",
  };
}

function defaultCoachesFilters(): CoachesFiltersState {
  return {
    month: monthKeyNow(),
    dateFrom: "",
    dateTo: "",
    coachId: "",
    lessonType: "all",
    lessonStatus: "all",
  };
}

function readOrgFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("org");
}

type MuhasebeFinansPageProps = {
  /** Birleşik Muhasebe & Finans sayfasında sekme olarak gömüldüğünde true: H1 + açıklama gizlenir. */
  embedded?: boolean;
};

export default function MuhasebeFinansPage({ embedded = false }: MuhasebeFinansPageProps = {}) {
  const router = useRouter();
  // Faz 10.1b — fetch lifecycle hook'a taşındı. Filter/modal/state page'de
  // kalır; hook sadece snapshot + loading + error orchestration sağlar.
  const dashboard = useAccountingFinanceDashboard();
  const snapshot = dashboard.snapshot;
  const loading = dashboard.loading || dashboard.refreshing;
  const loadError = dashboard.loadError;
  const [activeView, setActiveView] = useState<ViewTab>("genel");
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [draftGeneralFilters, setDraftGeneralFilters] = useState<GeneralFiltersState>(defaultGeneralFilters);
  const [appliedGeneralFilters, setAppliedGeneralFilters] = useState<GeneralFiltersState>(defaultGeneralFilters);
  const [draftCoachesFilters, setDraftCoachesFilters] = useState<CoachesFiltersState>(defaultCoachesFilters);
  const [appliedCoachesFilters, setAppliedCoachesFilters] = useState<CoachesFiltersState>(defaultCoachesFilters);
  const [filterApplyFeedback, setFilterApplyFeedback] = useState<string | null>(null);

  const activeViewRef = useRef<ViewTab>(activeView);
  const appliedGeneralRef = useRef(appliedGeneralFilters);
  const appliedCoachesRef = useRef(appliedCoachesFilters);
  const dataScopeRef = useRef<AccountingFinanceSnapshot["dataScope"]>("full");
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);
  useEffect(() => {
    appliedGeneralRef.current = appliedGeneralFilters;
  }, [appliedGeneralFilters]);
  useEffect(() => {
    appliedCoachesRef.current = appliedCoachesFilters;
  }, [appliedCoachesFilters]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalKey, setPaymentModalKey] = useState(0);
  const [paymentModalBusy, setPaymentModalBusy] = useState(false);

  const [filtersAdvancedOpen, setFiltersAdvancedOpen] = useState(false);
  const [coachesFiltersAdvancedOpen, setCoachesFiltersAdvancedOpen] = useState(false);
  const [canOpenAthletePayments, setCanOpenAthletePayments] = useState(false);
  const [refreshAck, setRefreshAck] = useState(false);
  const [financeLiveAt, setFinanceLiveAt] = useState<string | null>(null);
  const csvExport = useStreamingCsvDownload();
  const receivablesLiveRefreshRef = useRef<(() => void) | null>(null);

  const runFetch = useCallback(
    async (opts?: {
      view?: ViewTab;
      general?: GeneralFiltersState;
      coaches?: CoachesFiltersState;
    }): Promise<boolean> => {
      const view = opts?.view ?? activeViewRef.current;
      const isGeneral = view === "genel";
      const cf = isGeneral ? (opts?.general ?? appliedGeneralRef.current) : (opts?.coaches ?? appliedCoachesRef.current);
      const payload: AccountingFinanceFilters = {
        orgId: readOrgFromUrl(),
        month: cf.month,
        dateFrom: cf.dateFrom || undefined,
        dateTo: cf.dateTo || undefined,
        coachId: cf.coachId || undefined,
        lessonType: cf.lessonType as AccountingFinanceFilters["lessonType"],
        lessonStatus: cf.lessonStatus as AccountingFinanceFilters["lessonStatus"],
        paymentKind: isGeneral ? (cf as GeneralFiltersState).paymentKind || undefined : undefined,
        paymentStatus: isGeneral
          ? ((cf as GeneralFiltersState).paymentStatus as AccountingFinanceFilters["paymentStatus"])
          : "all",
        packageLifecycle: isGeneral
          ? ((cf as GeneralFiltersState).packageLifecycle as AccountingFinanceFilters["packageLifecycle"])
          : "all",
        packagePaymentState: isGeneral
          ? ((cf as GeneralFiltersState).packagePaymentState as AccountingFinanceFilters["packagePaymentState"])
          : "all",
        lessonsOnly: !isGeneral,
      };
      // Hook fetch lifecycle'ı yönetir; snapshot/loading/loadError otomatik
      // update edilir. Davranış parity: önceki ile aynı şekilde hata varsa
      // false döner.
      await dashboard.refresh(payload);
      if (dashboard.loadError) return false;
      // Hook'tan en güncel snapshot dataScope'unu ref'e taşı.
      // (Hook setState async olduğundan dashboard.snapshot bir sonraki
      //  render'da yenilenir; ref güncellemesi için snapshot useEffect ile
      //  senkronize edilir aşağıda.)
      return true;
    },
    [dashboard]
  );

  // Faz 10.1b — snapshot değişince dataScope ref'ini senkronla.
  useEffect(() => {
    if (snapshot) dataScopeRef.current = snapshot.dataScope;
  }, [snapshot]);

  const resetGeneralFilters = useCallback(() => {
    setActionFeedback(null);
    const next = defaultGeneralFilters();
    setDraftGeneralFilters(next);
    setAppliedGeneralFilters(next);
    setFiltersAdvancedOpen(false);
    void runFetch({ view: "genel", general: next });
  }, [runFetch]);

  const resetCoachesFilters = useCallback(() => {
    setActionFeedback(null);
    const next = defaultCoachesFilters();
    setDraftCoachesFilters(next);
    setAppliedCoachesFilters(next);
    setCoachesFiltersAdvancedOpen(false);
    void runFetch({ view: "koclar", coaches: next });
  }, [runFetch]);

  const applyGeneralFilters = useCallback(() => {
    const next = { ...draftGeneralFilters };
    setAppliedGeneralFilters(next);
    setFilterApplyFeedback("Filtreler uygulandı");
    window.setTimeout(() => setFilterApplyFeedback(null), 2400);
    void runFetch({ view: "genel", general: next });
  }, [draftGeneralFilters, runFetch]);

  const applyCoachesFilters = useCallback(() => {
    const next = { ...draftCoachesFilters };
    setAppliedCoachesFilters(next);
    setFilterApplyFeedback("Filtreler uygulandı");
    window.setTimeout(() => setFilterApplyFeedback(null), 2400);
    void runFetch({ view: "koclar", coaches: next });
  }, [draftCoachesFilters, runFetch]);

  const refreshDashboardHard = useCallback(async () => {
    const ok = await runFetch();
    receivablesLiveRefreshRef.current?.();
    router.refresh();
    if (ok) {
      setFinanceLiveAt(new Date().toISOString());
      setRefreshAck(true);
      window.setTimeout(() => setRefreshAck(false), 2600);
    }
  }, [runFetch, router]);

  const refreshFinanceSoft = useCallback(async () => {
    const ok = await runFetch();
    receivablesLiveRefreshRef.current?.();
    if (ok) {
      setFinanceLiveAt(new Date().toISOString());
      setRefreshAck(true);
      window.setTimeout(() => setRefreshAck(false), 1600);
    }
  }, [runFetch]);

  useFinanceRealtimeSync({
    organizationId: snapshot?.organizationId ?? null,
    enabled: Boolean(snapshot?.organizationId),
    onInvalidate: () => {
      void refreshFinanceSoft();
    },
  });

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void runFetch();
      }, 400);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runFetch]);

  useLayoutEffect(() => {
    if (activeView === "alacak") return;
    // runFetch dış (Supabase) sistemle senkronize olur ve sonuca göre state set
    // eder; effect içinde setState çağrısı kaçınılmaz.
    if (activeView === "genel" && dataScopeRef.current === "lessons_only") {
      void runFetch({ view: "genel" });
      return;
    }
    void runFetch({ view: activeView });
  }, [activeView, runFetch]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void (async () => {
        const me = await fetchMeRoleClient();
        if (cancelled || !me.ok) return;
        setCanOpenAthletePayments(me.role === "admin" || me.role === "super_admin");
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  const paymentKindOptions = useMemo(() => snapshot?.options.paymentKinds || [], [snapshot]);
  const periodLabel = useMemo(
    () => formatMonthLabel(activeView === "genel" ? appliedGeneralFilters.month : appliedCoachesFilters.month),
    [activeView, appliedCoachesFilters.month, appliedGeneralFilters.month]
  );

  const coachesOptions = snapshot?.options.coaches;

  const financeLiveTone: LiveStatusTone = loadError
    ? "degraded"
    : loading || dashboard.refreshing
      ? "syncing"
      : "live";

  const activeGeneralFilterSummary = useMemo(() => {
    const cf = appliedGeneralFilters;
    const rangePart =
      cf.dateFrom && cf.dateTo
        ? `${formatWallDateInputTr(cf.dateFrom)} - ${formatWallDateInputTr(cf.dateTo)} arası`
        : `${formatMonthLabel(cf.month)} · ay görünümü`;
    const coachPart = cf.coachId
      ? coachesOptions?.find((c) => c.id === cf.coachId)?.full_name || "Seçili koç"
      : "Tüm koçlar";
    const kindPart = cf.paymentKind ? getAccountingPaymentKindLabel(cf.paymentKind) : "Tüm ödeme türleri";
    return { rangePart, coachPart, kindPart };
  }, [appliedGeneralFilters, coachesOptions]);

  const activeCoachesFilterSummary = useMemo(() => {
    const cf = appliedCoachesFilters;
    const rangePart =
      cf.dateFrom && cf.dateTo
        ? `${formatWallDateInputTr(cf.dateFrom)} - ${formatWallDateInputTr(cf.dateTo)} arası`
        : `${formatMonthLabel(cf.month)} · ay görünümü`;
    const coachPart = cf.coachId
      ? coachesOptions?.find((c) => c.id === cf.coachId)?.full_name || "Seçili koç"
      : "Tüm koçlar";
    return { rangePart, coachPart };
  }, [appliedCoachesFilters, coachesOptions]);

  const lessons = snapshot?.lessons || [];

  const runPaymentsExport = useCallback(() => {
    const cf = appliedGeneralRef.current;
    const range = resolvePaymentsExportDateRange({
      month: cf.month,
      dateFrom: cf.dateFrom || undefined,
      dateTo: cf.dateTo || undefined,
    });
    if (!range) {
      setActionFeedback({ type: "error", message: "Geçersiz tarih aralığı. Başlangıç ve bitiş tarihlerini kontrol edin." });
      return;
    }
    const orgId = readOrgFromUrl();
    void csvExport.run(
      () => {
        const u = new URL("/api/exports/payments/stream", window.location.origin);
        u.searchParams.set("dateFrom", range.dateFrom);
        u.searchParams.set("dateTo", range.dateTo);
        if (orgId) u.searchParams.set("organizationId", orgId);
        if (cf.paymentStatus && cf.paymentStatus !== "all") {
          u.searchParams.set("paymentStatus", cf.paymentStatus);
        }
        if (cf.paymentKind) u.searchParams.set("paymentKind", cf.paymentKind);
        return u.toString();
      },
      {
        success: ({ rowCount, truncated }) =>
          truncated && rowCount != null && Number.isFinite(rowCount)
            ? `İlk ${rowCount} tahsilat satırı indirildi. Daha dar tarih aralığı deneyin.`
            : rowCount != null && Number.isFinite(rowCount)
              ? `${rowCount} tahsilat satırı indirildi.`
              : "Tahsilat CSV indirildi.",
      }
    );
  }, [csvExport]);

  if (loading && !snapshot && !loadError) {
    return (
      <div className={embedded ? "space-y-5" : "ui-page-loose space-y-5"} role="status" aria-label="Muhasebe verileri yükleniyor">
        {!embedded ? (
          <header className="rounded-xl border border-white/10 bg-[#121215] p-4">
            <h1 className="ui-h1">
              Muhasebe & <span className="text-green-500">Finans</span>
            </h1>
            <p className="mt-1 text-xs font-semibold text-gray-400">Tahsilat ve ders kayıtları yükleniyor...</p>
          </header>
        ) : null}
        <SkeletonStatGrid count={4} />
        <SkeletonTable rows={6} cols={8} />
      </div>
    );
  }

  const kpis = snapshot?.kpis;

  const periodChip = (
    <div className="inline-flex rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300">
      Dönem: <span className="ml-1 text-white">{periodLabel}</span>
    </div>
  );

  const refreshControls = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void refreshDashboardHard()}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:bg-white/5 disabled:opacity-50 sm:min-h-9"
        title="Sunucudan verileri yeniden yükle"
        aria-busy={loading && !!snapshot}
      >
        {loading && snapshot ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
        Yenile
      </button>
      {activeView === "genel" ? (
        <button
          type="button"
          onClick={runPaymentsExport}
          disabled={csvExport.exporting || loading}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:bg-white/5 disabled:opacity-50 sm:min-h-9"
          title="Tahsilat listesini CSV olarak indir (filtreyle)"
          aria-label="Tahsilat listesini CSV olarak indir"
        >
          {csvExport.exporting ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-400" aria-hidden />
          ) : (
            <Download size={12} className="shrink-0 opacity-80" aria-hidden />
          )}
          CSV indir
        </button>
      ) : null}
      {refreshAck ? (
        <span className="text-[10px] font-semibold text-emerald-400/90" role="status">
          Güncellendi
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      className={
        embedded
          ? "space-y-5"
          : "ui-page-loose space-y-5 pb-[max(4rem,env(safe-area-inset-bottom,0px))]"
      }
    >
      {embedded ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {periodChip}
          {refreshControls}
        </div>
      ) : (
        <header className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121215] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="ui-h1">
              Muhasebe & <span className="text-green-500">Finans</span>
            </h1>
            <p className="mt-1 text-xs font-semibold text-gray-400">
              Tahsilat ve ders kayıtlarını tek ekrandan takip edin. Bu ekran yalnızca manuel tahsilat takibi içindir; online
              ödeme veya kart işlemi yapılmaz.
              {canOpenAthletePayments ? (
                <>
                  {" "}
                  Sporcu bazlı özet için{" "}
                  <button type="button" onClick={() => router.push("/finans")} className="text-emerald-400 underline-offset-2 hover:underline">
                    Sporcu tahsilat özeti
                  </button>
                  .
                </>
              ) : null}
            </p>
            {!embedded ? (
              <div className="mt-3">
                <LiveConnectionStrip
                  status={financeLiveTone}
                  lastSyncLabel={
                    financeLiveAt
                      ? formatRelativeTimeTr(financeLiveAt)
                      : snapshot
                        ? "az önce"
                        : null
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {periodChip}
            {refreshControls}
          </div>
        </header>
      )}

      <section className="rounded-xl border border-white/10 bg-[#121215] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterApplyFeedback(null);
                setActiveView("genel");
              }}
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
              onClick={() => {
                setFilterApplyFeedback(null);
                setActiveView("alacak");
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-black uppercase transition-colors ${
                activeView === "alacak"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              Alacak takibi
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterApplyFeedback(null);
                setActiveView("koclar");
              }}
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
            {activeView === "genel"
              ? "Tahsilat + ders kayıtları"
              : activeView === "alacak"
                ? "Paket borcu · vade · manuel tahsilat takibi"
                : "Koç ders aktivitesi"}
          </p>
        </div>

        {activeView === "genel" ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => {
                setPaymentModalKey((k) => k + 1);
                setShowPaymentModal(true);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Tahsilat Kaydı Ekle
            </button>
          </div>
        ) : null}
      </section>

      {actionFeedback ? <Notification message={actionFeedback.message} variant={actionFeedback.type} /> : null}
      {csvExport.feedback ? (
        <Notification
          message={csvExport.feedback.text}
          variant={
            csvExport.feedback.tone === "err" ? "error" : csvExport.feedback.tone === "warn" ? "info" : "success"
          }
        />
      ) : null}

      {activeView === "alacak" ? (
        <MuhasebeReceivablesSection readOrgFromUrl={readOrgFromUrl} liveRefreshRef={receivablesLiveRefreshRef} />
      ) : (
        <>
      {loadError ? (
        <EmptyState
          variant="error"
          title="Veriler yüklenemedi"
          description={loadError}
          reason="Tekrar denemek için üstteki Yenile düğmesini kullanın."
          primaryAction={{ label: "Tekrar dene", onClick: () => void refreshDashboardHard() }}
        />
      ) : null}
      {snapshot?.compatibilityNotice ? (
        <p className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-100/90">
          <span aria-hidden>ⓘ</span>
          Eski tahsilat kayıtları farklı formatta olabilir; liste yine gösterilir.
        </p>
      ) : null}

      {activeView === "genel" ? (
        <MuhasebeFilterBar
          mode="genel"
          draft={draftGeneralFilters}
          onDraftChange={setDraftGeneralFilters}
          advancedOpen={filtersAdvancedOpen}
          onAdvancedToggle={() => setFiltersAdvancedOpen((o) => !o)}
          onApply={applyGeneralFilters}
          onReset={resetGeneralFilters}
          coachOptions={snapshot?.options.coaches || []}
          lessonTypeOptions={LESSON_TYPE_OPTIONS}
          lessonStatusOptions={LESSON_STATUS_OPTIONS}
          feedback={filterApplyFeedback}
          paymentKindOptions={paymentKindOptions}
          paymentKindLabel={getAccountingPaymentKindLabel}
          paymentStatusOptions={PAYMENT_STATUS_OPTIONS}
          summary={activeGeneralFilterSummary}
        />
      ) : (
        <MuhasebeFilterBar
          mode="koclar"
          draft={draftCoachesFilters}
          onDraftChange={setDraftCoachesFilters}
          advancedOpen={coachesFiltersAdvancedOpen}
          onAdvancedToggle={() => setCoachesFiltersAdvancedOpen((o) => !o)}
          onApply={applyCoachesFilters}
          onReset={resetCoachesFilters}
          coachOptions={snapshot?.options.coaches || []}
          lessonTypeOptions={LESSON_TYPE_OPTIONS}
          lessonStatusOptions={LESSON_STATUS_OPTIONS}
          feedback={filterApplyFeedback}
          summary={activeCoachesFilterSummary}
        />
      )}

      {activeView === "genel" ? (
        <MuhasebeKpiGridGeneral kpis={kpis} />
      ) : (
        <MuhasebeKpiGridCoaches kpis={kpis} />
      )}

      {activeView === "genel" ? (
        <MuhasebePaymentsTable
          rows={snapshot?.payments || []}
          canAdjustRecords={canOpenAthletePayments}
          organizationId={readOrgFromUrl() || undefined}
          onRecordsAdjusted={() => void refreshDashboardHard()}
          onAddPayment={() => {
            setPaymentModalKey((k) => k + 1);
            setShowPaymentModal(true);
          }}
          onResetFilters={() => {
            resetGeneralFilters();
            setFiltersAdvancedOpen(true);
          }}
        />
      ) : null}

      {activeView === "koclar" ? <MuhasebeCoachesTable rows={snapshot?.coachAggregates || []} /> : null}

      <MuhasebeLessonsTable
        rows={lessons}
        title={activeView === "genel" ? "Ders Listesi" : "Ders detayı"}
        onResetFilters={() => {
          if (activeView === "genel") {
            resetGeneralFilters();
            setFiltersAdvancedOpen(true);
          } else {
            resetCoachesFilters();
            setCoachesFiltersAdvancedOpen(true);
          }
        }}
        onGoLessonManagement={() => router.push("/haftalik-ders-programi")}
      />
        </>
      )}

      <MuhasebePaymentModal
        open={showPaymentModal}
        resetKey={paymentModalKey}
        busy={paymentModalBusy}
        organizationIdFromUrl={readOrgFromUrl()}
        athletes={snapshot?.options.athletes ?? []}
        onBusyChange={setPaymentModalBusy}
        onError={(message) => setActionFeedback({ type: "error", message })}
        onCancel={() => setShowPaymentModal(false)}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={async () => {
          setActionFeedback({ type: "success", message: "Tahsilat kaydı başarıyla eklendi." });
          await refreshDashboardHard();
          const oid = snapshot?.organizationId;
          if (oid) postFinanceTouch(oid, "payment-modal");
          setShowPaymentModal(false);
        }}
      />
    </div>
  );
}
