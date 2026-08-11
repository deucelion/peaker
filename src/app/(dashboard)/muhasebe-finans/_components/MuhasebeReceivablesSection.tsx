"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { DataTable, uiTableRowClass, uiTableTdClass, uiTableThClass } from "@/components/ui/data-display";
import { FinanceExportMenu } from "@/components/finance/FinanceExportMenu";
import { ReceivableAgingBuckets } from "@/components/finance/ReceivableAgingBuckets";
import type { ReceivableDashboardFilters } from "@/lib/actions/receivableDashboardActions";
import { createFinanceContactNote } from "@/lib/actions/financeNoteActions";
import { formatCurrencyTRY } from "@/lib/privateLessons/packageMath";
import { RECEIVABLE_STATUS_LABEL_TR, type ReceivableComputedStatus } from "@/lib/finance/receivableStatus";
import {
  PACKAGE_LIFECYCLE_LABEL,
  type PackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import { resolvePaymentsExportDateRange } from "@/lib/export/paymentsExportDateRange";
import { useStreamingCsvDownload } from "@/lib/hooks/useStreamingCsvDownload";
import { useMeAccessOrganizationFeatures } from "@/lib/auth/useMeAccess";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { shouldRenderExportUi } from "@/lib/navigation/exportFeatureVisibility";
import { useReceivablesDashboard } from "@/lib/hooks/useReceivablesDashboard";
import { isUuid } from "@/lib/validation/uuid";
import type { ReceivableFiltersState } from "./types";

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultReceivableFilters(): ReceivableFiltersState {
  return {
    month: monthKeyNow(),
    dateFrom: "",
    dateTo: "",
    athleteId: "",
    team: "",
    packageLifecycle: "all",
    pkgPaymentStatus: "all",
    receivableState: "all",
  };
}

const LIFECYCLE_OPTIONS: Array<{ value: "all" | PackageLifecycleStatus; label: string }> = [
  { value: "all", label: "Tüm paket durumları" },
  { value: "active", label: PACKAGE_LIFECYCLE_LABEL.active },
  { value: "paused", label: PACKAGE_LIFECYCLE_LABEL.paused },
  { value: "completed", label: PACKAGE_LIFECYCLE_LABEL.completed },
  { value: "cancelled", label: PACKAGE_LIFECYCLE_LABEL.cancelled },
  { value: "refunded", label: PACKAGE_LIFECYCLE_LABEL.refunded },
];

const PKG_PAY_OPTIONS = [
  { value: "all", label: "Tüm tahsilat durumları (paket)" },
  { value: "unpaid", label: "Ödenmedi" },
  { value: "partial", label: "Kısmi" },
  { value: "paid", label: "Tamam" },
] as const;

const RECV_OPTIONS: Array<{ value: "all" | ReceivableComputedStatus; label: string }> = [
  { value: "all", label: "Tüm alacak durumları" },
  ...(
    [
      "overdue",
      "due_soon",
      "partial_payment",
      "payment_pending",
      "payment_complete",
      "no_debt",
    ] as ReceivableComputedStatus[]
  ).map((v) => ({ value: v, label: RECEIVABLE_STATUS_LABEL_TR[v] })),
];

function formatMoney(value: number) {
  return formatCurrencyTRY(Number.isFinite(value) ? value : 0);
}

type Props = {
  readOrgFromUrl: () => string | null;
  /** FAZ 20: parent invalidates receivables when finans realtime fires. */
  liveRefreshRef?: MutableRefObject<(() => void) | null>;
};

export function MuhasebeReceivablesSection({ readOrgFromUrl, liveRefreshRef }: Props) {
  const dash = useReceivablesDashboard();
  const [draft, setDraft] = useState<ReceivableFiltersState>(defaultReceivableFilters);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const csv = useStreamingCsvDownload();

  const [noteAthleteId, setNoteAthleteId] = useState("");
  const [notePackageId, setNotePackageId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteMethod, setNoteMethod] = useState<"phone" | "whatsapp" | "in_person" | "other">("phone");
  const [noteFollowUp, setNoteFollowUp] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const organizationFeatures = useMeAccessOrganizationFeatures();

  const showReceivablesExportUi = shouldRenderExportUi(EXPORT_ENDPOINT_IDS.receivablesStream, {
    roleAllowed: true,
    permissionAllowed: true,
    organizationFeatures,
  });

  const buildFilters = useCallback(
    (cf: ReceivableFiltersState): ReceivableDashboardFilters => ({
      orgId: readOrgFromUrl(),
      month: cf.month,
      dateFrom: cf.dateFrom || undefined,
      dateTo: cf.dateTo || undefined,
      athleteId: cf.athleteId || undefined,
      teamContains: cf.team || undefined,
      packageLifecycle: (cf.packageLifecycle || "all") as ReceivableDashboardFilters["packageLifecycle"],
      pkgPaymentStatus: (cf.pkgPaymentStatus || "all") as ReceivableDashboardFilters["pkgPaymentStatus"],
      receivableState: (cf.receivableState || "all") as ReceivableDashboardFilters["receivableState"],
    }),
    [readOrgFromUrl]
  );

  useEffect(() => {
    void dash.refresh(buildFilters(draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(() => {
    setFeedback(null);
    void dash.refresh(buildFilters(draft));
  }, [buildFilters, dash, draft]);

  const reset = useCallback(() => {
    const next = defaultReceivableFilters();
    setDraft(next);
    void dash.refresh(buildFilters(next));
  }, [buildFilters, dash]);

  useEffect(() => {
    if (!liveRefreshRef) return;
    liveRefreshRef.current = () => {
      void dash.refresh(buildFilters(draftRef.current));
    };
    return () => {
      liveRefreshRef.current = null;
    };
  }, [liveRefreshRef, dash, buildFilters]);

  const overduePackages = useMemo(
    () => (dash.snapshot?.packageRows || []).filter((r) => r.receivableStatus === "overdue"),
    [dash.snapshot?.packageRows]
  );
  const dueSoonPackages = useMemo(
    () => (dash.snapshot?.packageRows || []).filter((r) => r.receivableStatus === "due_soon"),
    [dash.snapshot?.packageRows]
  );

  const notePackageLabel = useMemo(() => {
    if (!notePackageId) return null;
    const hit = (dash.snapshot?.packageRows || []).find((r) => r.packageId === notePackageId);
    return hit?.packageName ?? notePackageId.slice(0, 8);
  }, [dash.snapshot?.packageRows, notePackageId]);

  function scrollToNoteForm() {
    window.requestAnimationFrame(() => {
      document.getElementById("receivable-note-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function presetNote(athleteId: string, packageId?: string | null) {
    setNoteAthleteId(athleteId);
    setNotePackageId(packageId && isUuid(packageId) ? packageId : "");
    scrollToNoteForm();
  }

  const runExport = useCallback(
    (kind: "overdue" | "packages" | "athletes") => {
      const range = resolvePaymentsExportDateRange({
        month: draft.month,
        dateFrom: draft.dateFrom || undefined,
        dateTo: draft.dateTo || undefined,
      });
      if (!range) {
        setFeedback({ type: "error", message: "Geçersiz tarih aralığı." });
        return;
      }
      const org = readOrgFromUrl();
      void csv.run(
        () => {
          const u = new URL("/api/exports/receivables/stream", window.location.origin);
          u.searchParams.set("kind", kind);
          u.searchParams.set("dateFrom", range.dateFrom);
          u.searchParams.set("dateTo", range.dateTo);
          if (org) u.searchParams.set("organizationId", org);
          if (draft.athleteId) u.searchParams.set("athleteId", draft.athleteId);
          if (draft.team.trim()) u.searchParams.set("teamContains", draft.team.trim());
          if (draft.packageLifecycle !== "all") u.searchParams.set("packageLifecycle", draft.packageLifecycle);
          if (draft.pkgPaymentStatus !== "all") u.searchParams.set("pkgPaymentStatus", draft.pkgPaymentStatus);
          if (draft.receivableState !== "all") u.searchParams.set("receivableState", draft.receivableState);
          return u.toString();
        },
        { success: () => "CSV indirildi." }
      );
    },
    [csv, draft, readOrgFromUrl]
  );

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!noteAthleteId) {
      setFeedback({ type: "error", message: "Sporcu seçin." });
      return;
    }
    setNoteBusy(true);
    setFeedback(null);
    const fd = new FormData();
    fd.append("athleteId", noteAthleteId);
    fd.append("note", noteText.trim());
    fd.append("contactMethod", noteMethod);
    if (notePackageId && isUuid(notePackageId)) fd.append("packageId", notePackageId);
    const res = await createFinanceContactNote(fd);
    setNoteBusy(false);
    if ("error" in res && res.error) {
      setFeedback({ type: "error", message: res.error });
      return;
    }
    setFeedback({ type: "success", message: "Finans notu kaydedildi." });
    setNoteText("");
    setNotePackageId("");
    void dash.refresh(buildFilters(draft));
  }

  const k = dash.snapshot?.kpis;
  const athletes = dash.snapshot?.options.athletes || [];

  return (
    <div className="space-y-5">
      {feedback ? <Notification message={feedback.message} variant={feedback.type} /> : null}
      {csv.feedback ? (
        <Notification
          message={csv.feedback.text}
          variant={
            csv.feedback.tone === "err" ? "error" : csv.feedback.tone === "warn" ? "info" : "success"
          }
        />
      ) : null}

      {dash.loadError ? (
        <EmptyState
          variant="error"
          title="Alacak verileri yüklenemedi"
          description={dash.loadError}
          primaryAction={{ label: "Tekrar dene", onClick: () => void apply() }}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {(
          [
            {
              key: "alinan",
              label: "Alınan",
              hint: "Dönem içi tahsilat kaydı",
              value: k?.collectedInPeriod ?? 0,
              tone: "text-emerald-200",
            },
            {
              key: "bekleyen",
              label: "Bekleyen",
              hint: "Toplam açık bakiye",
              value: k?.totalPendingReceivable ?? 0,
              tone: "text-white",
            },
            {
              key: "gecikmis",
              label: "Gecikmiş",
              hint: "Vadesi geçen bakiye",
              value: k?.overdueReceivable ?? 0,
              tone: "text-rose-200",
            },
            {
              key: "yaklasan",
              label: "Yaklaşan",
              hint: "Vadesi yakın bakiye",
              value: k?.dueSoonReceivableAmount ?? 0,
              tone: "text-amber-100",
            },
          ] as const
        ).map((card) => (
          <div key={card.key} className="rounded-xl ui-kpi-band border px-3 py-3">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
            <p className={`mt-1 text-lg font-black tabular-nums leading-tight sm:text-xl ${card.tone}`}>
              {formatMoney(card.value)}
            </p>
            <p className="mt-1 text-[9px] font-semibold text-gray-600">{card.hint}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-gray-500">
        Borçlu sporcu: <span className="text-gray-400">{k?.debtorAthleteCount ?? 0}</span>
        <span className="mx-2 text-gray-700">·</span>
        Gecikmiş paket: <span className="text-gray-400">{k?.overduePackageCount ?? 0}</span>
        <span className="mx-2 text-gray-700">·</span>
        Yakın vadeli paket: <span className="text-gray-400">{k?.dueSoonPackageCount ?? 0}</span>
      </p>

      <section className="ui-kpi-section rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-black uppercase text-white">Filtreler</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-[10px] font-bold text-gray-400">
            Ay
            <input
              type="month"
              value={draft.month}
              onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Özel aralık başlangıç
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Özel aralık bitiş
            <input
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Sporcu
            <select
              value={draft.athleteId}
              onChange={(e) => setDraft((d) => ({ ...d, athleteId: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Takım (içerir)
            <input
              value={draft.team}
              onChange={(e) => setDraft((d) => ({ ...d, team: e.target.value }))}
              placeholder="örn. U17"
              list="receivable-team-hints"
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            />
            <datalist id="receivable-team-hints">
              {(dash.snapshot?.options.teamHints || []).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Paket durumu
            <select
              value={draft.packageLifecycle}
              onChange={(e) => setDraft((d) => ({ ...d, packageLifecycle: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            >
              {LIFECYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Paket ödeme durumu
            <select
              value={draft.pkgPaymentStatus}
              onChange={(e) => setDraft((d) => ({ ...d, pkgPaymentStatus: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            >
              {PKG_PAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Alacak durumu
            <select
              value={draft.receivableState}
              onChange={(e) => setDraft((d) => ({ ...d, receivableState: e.target.value }))}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            >
              {RECV_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void apply()}
            disabled={dash.loading || dash.refreshing}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
          >
            {dash.loading || dash.refreshing ? <Loader2 className="size-4 animate-spin" /> : "Uygula"}
          </button>
          <button
            type="button"
            onClick={() => void reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-[10px] font-black uppercase text-gray-300"
          >
            Sıfırla
          </button>
          {showReceivablesExportUi ? (
          <FinanceExportMenu
            exporting={csv.exporting}
            items={[
              { id: "overdue", label: "Gecikmiş alacaklar", description: "Vadesi geçen paketler", onSelect: () => runExport("overdue") },
              { id: "athletes", label: "Sporcu borcu", description: "Borçlu sporcu özeti", onSelect: () => runExport("athletes") },
              { id: "packages", label: "Paket borcu", description: "Tüm paket satırları", onSelect: () => runExport("packages") },
            ]}
          />
          ) : null}
        </div>
      </section>

      <ReceivableAgingBuckets packageRows={dash.snapshot?.packageRows ?? []} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ui-kpi-section rounded-xl p-4">
          <h3 className="text-xs font-black uppercase text-white">Borçlu sporcular</h3>
          {!dash.snapshot?.athleteDebts.length ? (
            <p className="mt-3 text-sm text-gray-500">Kayıt yok.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-[11px]">
              {dash.snapshot.athleteDebts.slice(0, 40).map((a) => (
                <li
                  key={a.athleteId}
                  className="flex flex-col gap-2 border-b border-white/5 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white">{a.athleteName}</p>
                    <p className="text-[10px] text-gray-500">
                      {a.team || "—"} · {a.packageCount} paket · {RECEIVABLE_STATUS_LABEL_TR[a.worstReceivableStatus]}
                    </p>
                    <p className="mt-1 font-black tabular-nums text-rose-100">{formatMoney(a.totalRemaining)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Link
                      href={`/sporcu/${a.athleteId}`}
                      className="inline-flex min-h-9 items-center rounded-lg border border-white/15 bg-white/5 px-2.5 text-[9px] font-black uppercase text-gray-200"
                    >
                      Sporcu
                    </Link>
                    <Link
                      href={`/finans/${a.athleteId}`}
                      className="inline-flex min-h-9 items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[9px] font-black uppercase text-emerald-200"
                    >
                      Tahsilat
                    </Link>
                    <button
                      type="button"
                      onClick={() => presetNote(a.athleteId, null)}
                      className={`${uiBrandingClasses.kpi.chipBrand} ${uiBrandingClasses.button.base} inline-flex min-h-9 items-center rounded-lg px-2.5 text-[9px] font-black uppercase`}
                    >
                      Not
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ui-kpi-section rounded-xl p-4">
          <h3 className="text-xs font-black uppercase text-white">Vadesi yaklaşan paketler</h3>
          {!dueSoonPackages.length ? (
            <p className="mt-3 text-sm text-gray-500">Kayıt yok.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-[11px]">
              {dueSoonPackages.slice(0, 30).map((r) => (
                <li
                  key={r.packageId}
                  className="flex flex-col gap-2 border-b border-white/5 pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link href={`/ozel-ders-paketleri/${r.packageId}`} className="font-bold ui-kpi-card__trend">
                      {r.packageName}
                    </Link>
                    <p className="text-[10px] text-gray-500">
                      {r.athleteName}
                      {r.daysUntilDue != null ? ` · ${r.daysUntilDue} gün` : ""}
                    </p>
                    <p className="mt-1 font-bold tabular-nums text-amber-100">{formatMoney(r.remainingBalance)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Link
                      href={`/sporcu/${r.athleteId}`}
                      className="inline-flex min-h-9 items-center rounded-lg border border-white/15 bg-white/5 px-2.5 text-[9px] font-black uppercase text-gray-200"
                    >
                      Sporcu
                    </Link>
                    <Link
                      href={`/ozel-ders-paketleri/${r.packageId}`}
                      className={`${uiBrandingClasses.kpi.chipBrand} ${uiBrandingClasses.button.base} inline-flex min-h-9 items-center rounded-lg px-2.5 text-[9px] font-black uppercase`}
                    >
                      Paket
                    </Link>
                    <button
                      type="button"
                      onClick={() => presetNote(r.athleteId, r.packageId)}
                      className="inline-flex min-h-9 items-center rounded-lg border border-white/15 px-2.5 text-[9px] font-black uppercase text-gray-300"
                    >
                      Not
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ui-kpi-section rounded-xl p-4 overflow-x-auto">
        <h3 className="text-xs font-black uppercase text-white">Gecikmiş paketler</h3>
        {!overduePackages.length ? (
          <p className="mt-3 text-sm text-gray-500">Gecikmiş paket yok.</p>
        ) : (
          <DataTable
            bare
            className="mt-3"
            scrollClassName=""
            tableClassName="w-full min-w-[880px] text-[11px]"
            headClassName="ui-table-head ui-table-head--divided"
            head={
              <tr>
                <th className={`${uiTableThClass} pb-2`}>Paket</th>
                <th className={`${uiTableThClass} pb-2`}>Sporcu</th>
                <th className={`${uiTableThClass} pb-2`}>Kalan</th>
                <th className={`${uiTableThClass} pb-2`}>Vade</th>
                <th className={`${uiTableThClass} pb-2`}>Gün</th>
                <th className={`${uiTableThClass} pb-2`}>Aksiyon</th>
              </tr>
            }
          >
            {overduePackages.map((r) => (
              <tr key={r.packageId} className={`${uiTableRowClass} text-gray-200`}>
                <td className={`${uiTableTdClass} py-2`}>
                  <Link href={`/ozel-ders-paketleri/${r.packageId}`} className="ui-kpi-card__trend font-semibold">
                    {r.packageName}
                  </Link>
                </td>
                <td className={`${uiTableTdClass} py-2`}>{r.athleteName}</td>
                <td className={`${uiTableTdClass} py-2 tabular-nums`}>{formatMoney(r.remainingBalance)}</td>
                <td className={`${uiTableTdClass} py-2`}>
                  {r.nextPaymentDueAt ? new Date(r.nextPaymentDueAt).toLocaleDateString("tr-TR") : "—"}
                </td>
                <td className={`${uiTableTdClass} py-2 text-rose-200 tabular-nums`}>{r.daysOverdue ?? "—"}</td>
                <td className={`${uiTableTdClass} py-2`}>
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={`/sporcu/${r.athleteId}`}
                      className="inline-flex min-h-8 items-center rounded-md border border-white/15 bg-white/5 px-2 text-[9px] font-black uppercase text-gray-200"
                    >
                      Sporcu
                    </Link>
                    <Link
                      href={`/ozel-ders-paketleri/${r.packageId}`}
                      className={`${uiBrandingClasses.kpi.chipBrand} ${uiBrandingClasses.button.base} inline-flex min-h-8 items-center rounded-md px-2 text-[9px] font-black uppercase`}
                    >
                      Paket
                    </Link>
                    <button
                      type="button"
                      onClick={() => presetNote(r.athleteId, r.packageId)}
                      className="inline-flex min-h-8 items-center rounded-md border border-white/15 px-2 text-[9px] font-black uppercase text-gray-300"
                    >
                      Not
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section id="receivable-note-block" className="scroll-mt-24 ui-kpi-section rounded-xl p-4">
        <h3 className="text-xs font-black uppercase text-white">Finans görüşme notu</h3>
        <p className="mt-1 text-[10px] text-gray-500">
          Zorunlu alanlar: sporcu ve not. Paket seçiliyse not kaydı pakete de bağlanır (liste üzerindeki &quot;Not&quot; ile
          ön doldurulur).
        </p>
        {notePackageId ? (
          <div className={`${uiBrandingClasses.kpi.chipBrand} mt-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-[10px]`}>
            <span className="font-bold">Paket:</span>
            <span className="font-semibold">{notePackageLabel}</span>
            <button
              type="button"
              onClick={() => setNotePackageId("")}
              className="ml-auto rounded border border-white/20 px-2 py-0.5 text-[9px] font-black uppercase text-gray-300"
            >
              Paketi ayır
            </button>
          </div>
        ) : null}
        <form onSubmit={(e) => void submitNote(e)} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-[10px] font-bold text-gray-400 md:col-span-2">
            Sporcu
            <select
              value={noteAthleteId}
              onChange={(e) => setNoteAthleteId(e.target.value)}
              required
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seçin</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold text-gray-400 md:col-span-2">
            Not
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              required
              minLength={2}
              rows={3}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            İletişim
            <select
              value={noteMethod}
              onChange={(e) => setNoteMethod(e.target.value as typeof noteMethod)}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="phone">Telefon</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="in_person">Yüz yüze</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Takip tarihi
            <input
              type="date"
              value={noteFollowUp}
              onChange={(e) => setNoteFollowUp(e.target.value)}
              className="mt-1 w-full ui-input rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={noteBusy}
              className="ui-btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
            >
              {noteBusy ? <Loader2 className="size-4 animate-spin" /> : "Notu kaydet"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
