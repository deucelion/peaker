"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { CollectionPaymentForm } from "@/components/finance/CollectionPaymentForm";
import {
  loadAccountingFinanceDashboard,
  type AccountingFinanceSnapshot,
} from "@/lib/actions/accountingFinanceActions";
import MuhasebeFinansPage from "@/app/(dashboard)/muhasebe-finans/page";
import FinansYonetimi from "@/app/(dashboard)/finans/page";

type WorkspaceView = "panel" | "sporcu" | "tahsilat";

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function MuhasebeFinansContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgFromUrl = searchParams.get("org");
  const sporcu = (searchParams.get("sporcu") || "").trim();
  const paket = (searchParams.get("paket") || "").trim();
  const tur = (searchParams.get("tur") || "").trim();
  const bolumParam = (searchParams.get("bolum") || "").toLowerCase();

  const view: WorkspaceView = useMemo(() => {
    if (bolumParam === "tahsilat" || bolumParam === "panel" || bolumParam === "sporcu") {
      return bolumParam;
    }
    return sporcu || paket || tur ? "tahsilat" : "panel";
  }, [bolumParam, sporcu, paket, tur]);

  const switchView = useCallback(
    (target: WorkspaceView) => {
      const next = new URLSearchParams(searchParams.toString());
      if (target === "panel") {
        next.delete("bolum");
        next.delete("sporcu");
        next.delete("paket");
        next.delete("tur");
      } else if (target === "tahsilat") {
        next.set("bolum", "tahsilat");
      } else {
        next.set("bolum", "sporcu");
        next.delete("sporcu");
        next.delete("paket");
        next.delete("tur");
      }
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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const runFetch = useCallback(async () => {
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

  useEffect(() => {
    if (view !== "tahsilat") return;
    // runFetch dış sistem (Supabase action) ile senkronize olur ve sonuca göre
    // state set eder; effect içinde setState çağrısı kaçınılmaz. Cascading
    // render uyarısını burada bilerek bastırıyoruz.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runFetch();
  }, [view, runFetch]);

  const tabBaseClass =
    "min-h-10 inline-flex items-center justify-center rounded-xl px-4 text-[10px] font-black uppercase tracking-wide transition-colors";
  const tabActiveClass = "bg-emerald-500 text-black shadow-md shadow-emerald-500/15";
  const tabIdleClass = "border border-white/10 bg-black/30 text-gray-300 hover:bg-white/5";

  const scopeBadge =
    view === "panel"
      ? { label: "Bu dönem", tone: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200", hint: "Panel KPI'ları yalnızca seçili ay/aralığı kapsar." }
      : view === "sporcu"
        ? { label: "Tüm zaman", tone: "border-amber-500/35 bg-amber-500/10 text-amber-200", hint: "Sporcu kartları toplam borcu / tüm zaman ödemesini gösterir." }
        : { label: "Yeni kayıt", tone: "border-cyan-500/35 bg-cyan-500/10 text-cyan-200", hint: "Form gönderildiğinde Panel ve Sporcu sekmeleri otomatik tazelenir." };

  return (
    <div className="ui-page-loose space-y-5 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121215] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="ui-h1">
            Muhasebe &amp; <span className="text-green-500">Finans</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Panel raporları ve yeni tahsilat girişini tek workspace üzerinden yönetin.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => switchView("panel")}
                aria-pressed={view === "panel"}
                className={`${tabBaseClass} ${view === "panel" ? tabActiveClass : tabIdleClass}`}
              >
                Panel
              </button>
              <button
                type="button"
                onClick={() => switchView("sporcu")}
                aria-pressed={view === "sporcu"}
                className={`${tabBaseClass} ${view === "sporcu" ? tabActiveClass : tabIdleClass}`}
              >
                Sporcu ödemeleri
              </button>
              <button
                type="button"
                onClick={() => switchView("tahsilat")}
                aria-pressed={view === "tahsilat"}
                className={`${tabBaseClass} ${view === "tahsilat" ? tabActiveClass : tabIdleClass}`}
              >
                Yeni tahsilat
              </button>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${scopeBadge.tone}`}
              title={scopeBadge.hint}
            >
              {scopeBadge.label}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-gray-500" role="note">
            {scopeBadge.hint}
          </p>
        </div>
      </header>

      {view === "panel" ? (
        <MuhasebeFinansPage embedded />
      ) : view === "sporcu" ? (
        <FinansYonetimi embedded />
      ) : (
        <>
          {feedback ? (
            <Notification
              message={feedback.message}
              variant={feedback.type === "success" ? "success" : "error"}
            />
          ) : null}

          {loadError && !snapshot ? (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3">
              <Notification message={loadError} variant="error" />
              <p className="mt-2 text-[11px] font-semibold text-red-200/90">
                Super admin iseniz bağlantıda <span className="font-mono text-white">?org=ORG_UUID</span> kullanın.
              </p>
            </div>
          ) : null}

          {tahsilatLoading && !snapshot ? (
            <div className="flex min-h-[35dvh] items-center justify-center text-green-500">
              <Loader2 className="size-10 animate-spin" aria-hidden />
            </div>
          ) : (
            <section className="rounded-xl border border-white/10 bg-[#121215] p-5 sm:p-6">
              <h2 className="text-sm font-black uppercase text-white">Yeni tahsilat</h2>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
                Sporcu ödemeleri veya özel ders paketinden geldiyseniz alanlar önceden seçilir.
              </p>
              <div className="mt-5">
                <CollectionPaymentForm
                  organizationIdFromUrl={orgFromUrl}
                  athletes={snapshot?.options.athletes ?? []}
                  resetKey={formResetKey}
                  initialPrefill={initialPrefill}
                  layout="page"
                  onError={(message) => setFeedback({ type: "error", message })}
                  onSuccess={async () => {
                    setFeedback({ type: "success", message: "Tahsilat kaydı başarıyla eklendi." });
                    await runFetch();
                    setFormResetKey((k) => k + 1);
                  }}
                />
              </div>
            </section>
          )}
        </>
      )}
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
      <MuhasebeFinansContent />
    </Suspense>
  );
}
