"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import Notification from "@/components/Notification";
import { MuhasebeFinansPanel } from "@/app/(dashboard)/muhasebe-finans/_components/MuhasebeFinansPanel";
import { FinansYonetimi } from "@/components/finance/FinansYonetimi";
import { MuhasebeOverviewSection } from "@/components/finance/MuhasebeOverviewSection";
import { TahsilatRecordSheet } from "@/components/finance/TahsilatRecordSheet";
import { FinanceScopeChip, FinanceScopeHint } from "@/components/finance/FinanceScopeChip";
import type { FinanceScopeKind } from "@/components/finance/FinanceScopeChip";
import {
  HUB_TAB_LABELS,
  resolveHubView,
  type HubWorkspaceView,
} from "@/lib/finance/hubViews";
import {
  loadAccountingFinanceDashboard,
  type AccountingFinanceSnapshot,
} from "@/lib/actions/accountingFinanceActions";

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const HUB_TABS: HubWorkspaceView[] = ["ozet", "tahsilatlar", "alacaklar", "sporcular", "koclar"];

function scopeForView(view: HubWorkspaceView): FinanceScopeKind {
  if (view === "sporcular") return "all_time";
  if (view === "alacaklar") return "overdue";
  return "period";
}

function TahsilatMerkeziContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgFromUrl = searchParams.get("org");
  const sporcu = (searchParams.get("sporcu") || "").trim();
  const paket = (searchParams.get("paket") || "").trim();
  const tur = (searchParams.get("tur") || "").trim();
  const bolumParam = searchParams.get("bolum");

  const view: HubWorkspaceView = useMemo(
    () => resolveHubView({ bolum: bolumParam }),
    [bolumParam]
  );

  const tahsilatDrawerRequested = bolumParam === "tahsilat" || Boolean(sporcu || paket || tur);

  const switchView = useCallback(
    (target: HubWorkspaceView, preset?: "gecmis") => {
      const next = new URLSearchParams(searchParams.toString());
      if (target === "ozet") {
        next.delete("bolum");
      } else {
        next.set("bolum", target);
      }
      if (preset === "gecmis" && target === "tahsilatlar") next.set("durum", "gecmis");
      else next.delete("durum");
      next.delete("sporcu");
      next.delete("paket");
      next.delete("tur");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const initialPrefill = useMemo(
    () => ({
      profileId: sporcu || undefined,
      packageId: paket || undefined,
      paymentKind: tur || undefined,
    }),
    [sporcu, paket, tur]
  );

  const [snapshot, setSnapshot] = useState<AccountingFinanceSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tahsilatLoading, setTahsilatLoading] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [tahsilatOpen, setTahsilatOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const runFetchAthletes = useCallback(async () => {
    setTahsilatLoading(true);
    const res = await loadAccountingFinanceDashboard({
      orgId: orgFromUrl,
      month: monthKeyNow(),
      lessonType: "all",
      lessonStatus: "all",
      paymentStatus: "all",
    });
    if ("error" in res) {
      setLoadError(res.error);
      setSnapshot(null);
      setTahsilatLoading(false);
      return;
    }
    setLoadError(null);
    setSnapshot(res.snapshot);
    setTahsilatLoading(false);
  }, [orgFromUrl]);

  const openTahsilatDrawer = useCallback(() => {
    setFormResetKey((k) => k + 1);
    setTahsilatOpen(true);
    void runFetchAthletes();
  }, [runFetchAthletes]);

  useEffect(() => {
    if (!tahsilatDrawerRequested) return;
    openTahsilatDrawer();
    // Yalnızca URL ile drawer istendiğinde aç (deep link / hızlı aksiyon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahsilatDrawerRequested]);

  const closeTahsilatDrawer = useCallback(() => {
    if (sheetBusy) return;
    setTahsilatOpen(false);
    if (tahsilatDrawerRequested) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("bolum");
      next.delete("sporcu");
      next.delete("paket");
      next.delete("tur");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [sheetBusy, tahsilatDrawerRequested, searchParams, pathname, router]);

  const tabBaseClass =
    "min-h-10 inline-flex items-center justify-center rounded-xl px-3 text-[10px] font-black uppercase tracking-wide transition-colors sm:px-4";
  const tabActiveClass = "bg-emerald-500 text-black shadow-md shadow-emerald-500/15";
  const tabIdleClass = "border border-white/10 bg-black/30 text-gray-300 hover:bg-white/5";

  const scope = scopeForView(view);

  return (
    <div className="ui-page-loose space-y-5 pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121215] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="ui-h1">
            Tahsilat <span className="text-green-500">Merkezi</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Muhasebe, alacak takibi ve sporcu ödemelerini tek workspace üzerinden yönetin.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {HUB_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => switchView(tab)}
                  aria-pressed={view === tab}
                  className={`${tabBaseClass} ${view === tab ? tabActiveClass : tabIdleClass}`}
                >
                  {HUB_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <FinanceScopeChip scope={scope} />
          </div>
          <div className="mt-2">
            <FinanceScopeHint scope={scope} />
          </div>
        </div>
        <button
          type="button"
          onClick={openTahsilatDrawer}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
        >
          <Plus size={14} aria-hidden />
          Tahsilat kaydet
        </button>
      </header>

      {feedback ? (
        <Notification message={feedback.message} variant={feedback.type === "success" ? "success" : "error"} />
      ) : null}

      {view === "ozet" ? (
        <MuhasebeOverviewSection
          orgId={orgFromUrl}
          onOpenTahsilat={openTahsilatDrawer}
          onNavigateSection={switchView}
        />
      ) : null}

      {view === "tahsilatlar" ? (
        <MuhasebeFinansPanel
          key={`tahsilatlar-${searchParams.get("durum") || "all"}`}
          embedded
          forcedView="genel"
          hideViewTabs
          hidePaymentCta
          initialPaymentStatus={searchParams.get("durum") === "gecmis" ? "bekliyor" : undefined}
        />
      ) : null}

      {view === "alacaklar" ? (
        <MuhasebeFinansPanel embedded forcedView="alacak" hideViewTabs hidePaymentCta />
      ) : null}

      {view === "sporcular" ? <FinansYonetimi embedded /> : null}

      {view === "koclar" ? (
        <MuhasebeFinansPanel embedded forcedView="koclar" hideViewTabs hidePaymentCta />
      ) : null}

      {loadError && tahsilatOpen && !snapshot ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3">
          <Notification message={loadError} variant="error" />
        </div>
      ) : null}

      {tahsilatLoading && tahsilatOpen && !snapshot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Loader2 className="size-10 animate-spin text-emerald-400" aria-hidden />
        </div>
      ) : null}

      <TahsilatRecordSheet
        open={tahsilatOpen}
        organizationIdFromUrl={orgFromUrl}
        athletes={snapshot?.options.athletes ?? []}
        resetKey={formResetKey}
        initialPrefill={initialPrefill}
        busy={sheetBusy}
        onBusyChange={setSheetBusy}
        onClose={closeTahsilatDrawer}
        onError={(message) => setFeedback({ type: "error", message })}
        onSuccess={async () => {
          setFeedback({ type: "success", message: "Tahsilat kaydı başarıyla eklendi." });
          await runFetchAthletes();
          setFormResetKey((k) => k + 1);
          closeTahsilatDrawer();
        }}
      />

      {!tahsilatOpen ? (
        <button
          type="button"
          onClick={openTahsilatDrawer}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-500 px-5 text-[10px] font-black uppercase tracking-wide text-black shadow-xl shadow-emerald-500/25 hover:bg-emerald-400 lg:hidden"
          aria-label="Tahsilat kaydet"
        >
          <Plus size={16} aria-hidden />
          Tahsilat
        </button>
      ) : null}
    </div>
  );
}

export default function TahsilatMerkeziPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[45dvh] items-center justify-center text-green-500">
          <Loader2 className="size-10 animate-spin" aria-hidden />
        </div>
      }
    >
      <TahsilatMerkeziContent />
    </Suspense>
  );
}
