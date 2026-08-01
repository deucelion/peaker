"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Download,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { InlineErrorState } from "@/components/ui/data-display";
import { SkeletonTable } from "@/components/ui/skeletons";
import type { AuditLogListItem } from "@/lib/actions/auditLogTypes";
import { useStreamingCsvDownload } from "@/lib/hooks/useStreamingCsvDownload";
import {
  ALL_AUDIT_ACTIONS,
  ALL_AUDIT_ENTITIES,
  actionLabel,
  actionToneClass,
  entityLabel,
  metadataEntries,
  metadataValueToString,
} from "@/lib/audit/labels";
import { auditListErrorMessage } from "@/lib/audit/auditDiagnostics";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
  AUDIT_LOG_PAGE_SIZE as PAGE_SIZE,
  useAuditLogViewer,
  type AuditLogFilterState as FilterState,
} from "@/lib/hooks/useAuditLogViewer";
import { DataTablePagination } from "@/components/ui/data-display";
import { fetchMeAccessClient } from "@/lib/auth/meAccessClient";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { shouldRenderExportUi } from "@/lib/navigation/exportFeatureVisibility";

type FilterPreset = "today" | "7d" | "30d" | "all";

function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function todayKey(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

function applyPreset(preset: FilterPreset): Pick<FilterState, "fromIso" | "toIso"> {
  if (preset === "today") return { fromIso: todayKey(), toIso: todayKey() };
  if (preset === "7d") return { fromIso: daysAgoKey(6), toIso: todayKey() };
  if (preset === "30d") return { fromIso: daysAgoKey(29), toIso: todayKey() };
  return { fromIso: "", toIso: "" };
}

function presetMatches(filter: FilterState, preset: FilterPreset): boolean {
  const target = applyPreset(preset);
  return filter.fromIso === target.fromIso && filter.toIso === target.toIso;
}

export default function AuditLogPage() {
  const {
    filter,
    items,
    total,
    loading,
    error,
    errorKind,
    diagnosticsCode,
    status,
    isError,
    scopeOrgId,
    refetch: fetchData,
    setFilter,
    resetFilter,
  } = useAuditLogViewer();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedDetail, setSelectedDetail] = useState<AuditLogListItem | null>(null);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [organizationFeatures, setOrganizationFeatures] = useState<OrganizationFeatures | null>(null);
  const csvExport = useStreamingCsvDownload();

  useEffect(() => {
    let cancelled = false;
    void fetchMeAccessClient().then((payload) => {
      if (!cancelled && payload.ok) {
        setOrganizationFeatures(payload.organizationFeatures);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showAuditExportUi = shouldRenderExportUi(EXPORT_ENDPOINT_IDS.auditLogStream, {
    roleAllowed: true,
    permissionAllowed: true,
    organizationFeatures,
  });

  const runStreamingExport = useCallback(() => {
    void csvExport.run(
      () => {
        const u = new URL("/api/exports/audit-log/stream", window.location.origin);
        if (filter.action) u.searchParams.set("action", filter.action);
        if (filter.entityType) u.searchParams.set("entityType", filter.entityType);
        if (filter.fromIso) u.searchParams.set("fromIso", filter.fromIso);
        if (filter.toIso) u.searchParams.set("toIso", filter.toIso);
        if (scopeOrgId) u.searchParams.set("organizationId", scopeOrgId);
        return u.toString();
      },
      {
        success: ({ rowCount, truncated }) =>
          truncated && rowCount != null && Number.isFinite(rowCount)
            ? `İlk ${rowCount} satır indirildi. Daha dar tarih aralığı deneyin.`
            : rowCount != null && Number.isFinite(rowCount)
              ? `${rowCount} kayıt indirildi.`
              : "CSV indirildi.",
      }
    );
  }, [csvExport, filter.action, filter.entityType, filter.fromIso, filter.toIso, scopeOrgId]);

  useEffect(() => {
    if (!selectedDetail) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDetail(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedDetail]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter((i) =>
      i.actorName.toLowerCase().includes(q) ||
      i.action.toLowerCase().includes(q) ||
      actionLabel(i.action).toLowerCase().includes(q) ||
      i.entityType.toLowerCase().includes(q) ||
      entityLabel(i.entityType).toLowerCase().includes(q) ||
      i.entityId.toLowerCase().includes(q)
    );
  }, [items, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterChips = useMemo(() => {
    const out: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (filter.action) {
      out.push({
        key: "action",
        label: `Aksiyon: ${actionLabel(filter.action)}`,
        onClear: () => setFilter((f) => ({ ...f, action: "", page: 1 })),
      });
    }
    if (filter.entityType) {
      out.push({
        key: "entity",
        label: `Tür: ${entityLabel(filter.entityType)}`,
        onClear: () => setFilter((f) => ({ ...f, entityType: "", page: 1 })),
      });
    }
    if (filter.fromIso || filter.toIso) {
      out.push({
        key: "range",
        label: `Aralık: ${filter.fromIso || "…"} → ${filter.toIso || "…"}`,
        onClear: () =>
          setFilter((f) => ({ ...f, fromIso: "", toIso: "", page: 1 })),
      });
    }
    if (search.trim()) {
      out.push({
        key: "search",
        label: `Arama: ${search.trim()}`,
        onClear: () => setSearch(""),
      });
    }
    return out;
  }, [filter, search, setFilter]);

  function applyDateRangePreset(preset: FilterPreset) {
    setFilter((f) => ({ ...f, ...applyPreset(preset), page: 1 }));
    if (preset !== "all") setShowCustomRange(false);
  }

  function clearAllFilters() {
    resetFilter();
    setSearch("");
    setShowCustomRange(false);
  }

  if (status === "loading") {
    return (
      <div className="ui-page-loose space-y-5 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
        <header className="space-y-2">
          <h1 className="ui-h1">
            Audit <span className="text-[#7c3aed]">Kayıtları</span>
          </h1>
        </header>
        <SkeletonTable rows={8} cols={4} />
      </div>
    );
  }

  if (errorKind === "permission_denied") {
    return (
      <div className="ui-page-loose space-y-4 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
        <header className="space-y-2">
          <h1 className="ui-h1">
            Audit <span className="text-[#7c3aed]">Kayıtları</span>
          </h1>
        </header>
        <div
          className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100"
          role="status"
          aria-live="polite"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-wide">Bu alanı görüntüleme yetkiniz yok.</p>
            <p className="text-[10px] font-semibold normal-case text-amber-200/80">{error}</p>
          </div>
        </div>
        <Link href="/" className="text-[10px] font-black uppercase text-[#7c3aed]">← Ana Panel</Link>
      </div>
    );
  }

  return (
    <div className="ui-page-loose space-y-5 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0 space-y-2">
          <h1 className="ui-h1">
            Audit <span className="text-[#7c3aed]">Kayıtları</span>
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Yönetim eylemlerinin değişmez izi · {total} kayıt
            {scopeOrgId ? " · org filtreli" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Aktör, aksiyon ya da kimlik ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-10 rounded-xl border border-white/10 bg-[#121215] px-3 pl-9 text-xs text-white placeholder:text-gray-600 outline-none focus:border-[#7c3aed]"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-[#7c3aed]/40 hover:text-white sm:min-h-10"
          >
            <Loader2
              className={`size-3.5 ${loading ? "animate-spin text-[#7c3aed]" : "opacity-50"}`}
              aria-hidden
            />
            Yenile
          </button>
          {showAuditExportUi ? (
          <button
            type="button"
            disabled={csvExport.exporting}
            onClick={runStreamingExport}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-emerald-500/40 hover:text-white disabled:opacity-50 sm:min-h-10"
            aria-label="Audit kayıtlarını CSV olarak indir (streaming)"
          >
            {csvExport.exporting ? (
              <Loader2 className="size-3.5 animate-spin text-emerald-400" aria-hidden />
            ) : (
              <Download size={14} className="opacity-80" aria-hidden />
            )}
            CSV indir
          </button>
          ) : null}
          {showAuditExportUi && csvExport.exporting ? (
            <button
              type="button"
              onClick={csvExport.cancel}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-black uppercase tracking-widest text-red-200 hover:border-red-500/50 sm:min-h-10"
            >
              İptal
            </button>
          ) : null}
        </div>
        {showAuditExportUi && csvExport.exporting ? (
          <p className="text-[10px] font-bold text-gray-500" aria-live="polite">
            Aktarılıyor… {csvExport.bytes > 0 ? `${(csvExport.bytes / 1024).toFixed(1)} KB` : ""}
          </p>
        ) : null}
        {showAuditExportUi && csvExport.phase === "aborted" ? (
          <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-200">
            İptal
          </span>
        ) : null}
        {showAuditExportUi && csvExport.phase === "failed" ? (
          <button
            type="button"
            onClick={runStreamingExport}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-3 text-[9px] font-black uppercase tracking-widest text-white"
          >
            <RotateCcw size={12} aria-hidden />
            Tekrar dene
          </button>
        ) : null}
      </header>

      <section
        className="rounded-2xl border border-white/8 bg-[#121215] p-4 sm:p-5 space-y-3 min-w-0"
        aria-label="Audit filtreleri"
      >
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["today", "Bugün"],
              ["7d", "Son 7 gün"],
              ["30d", "Son 30 gün"],
              ["all", "Tüm tarihler"],
            ] as const
          ).map(([key, label]) => {
            const active = presetMatches(filter, key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyDateRangePreset(key)}
                className={`min-h-11 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition sm:min-h-9 ${
                  active
                    ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowCustomRange((s) => !s)}
            className={`min-h-11 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition sm:min-h-9 ${
              showCustomRange
                ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white"
            }`}
          >
            <CalendarDays size={12} className="mr-1 inline align-[-2px] text-[#7c3aed]" aria-hidden />
            Özel aralık
          </button>
          <div className="ml-auto flex items-center gap-2">
            <select
              className="min-h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-white/20 focus:border-[#7c3aed] outline-none sm:min-h-9"
              value={filter.action}
              onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value, page: 1 }))}
            >
              <option value="">Tüm aksiyonlar</option>
              {ALL_AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </select>
            <select
              className="min-h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-white/20 focus:border-[#7c3aed] outline-none sm:min-h-9"
              value={filter.entityType}
              onChange={(e) => setFilter((f) => ({ ...f, entityType: e.target.value, page: 1 }))}
            >
              <option value="">Tüm türler</option>
              {ALL_AUDIT_ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {entityLabel(e)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showCustomRange && (
          <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[8px] font-black uppercase tracking-widest text-gray-500">
              Başlangıç
              <input
                type="date"
                className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white"
                value={filter.fromIso}
                onChange={(e) => setFilter((f) => ({ ...f, fromIso: e.target.value, page: 1 }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[8px] font-black uppercase tracking-widest text-gray-500">
              Bitiş
              <input
                type="date"
                className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white"
                value={filter.toIso}
                onChange={(e) => setFilter((f) => ({ ...f, toIso: e.target.value, page: 1 }))}
              />
            </label>
          </div>
        )}

        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Aktif filtreler:</span>
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-gray-200"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onClear}
                  className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-white/10 hover:text-white"
                  aria-label={`${chip.label} filtresini kaldır`}
                >
                  <X size={10} aria-hidden />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white"
            >
              <RotateCcw size={11} aria-hidden />
              Tümünü temizle
            </button>
          </div>
        )}
      </section>

      {isError && errorKind ? (
        <InlineErrorState
          errorKind={errorKind}
          title={auditListErrorMessage(errorKind, error).title}
          description={
            diagnosticsCode
              ? `${auditListErrorMessage(errorKind, error).description} (Tanı kodu: ${diagnosticsCode})`
              : auditListErrorMessage(errorKind, error).description
          }
          onRetry={
            errorKind === "fetch_error" || errorKind === "timeout"
              ? () => void fetchData()
              : undefined
          }
        />
      ) : null}
      {csvExport.feedback ? (
        <Notification
          message={csvExport.feedback.text}
          variant={
            csvExport.feedback.tone === "err" ? "error" : csvExport.feedback.tone === "warn" ? "info" : "success"
          }
        />
      ) : null}

      <section className="rounded-2xl border border-white/8 bg-[#121215] min-w-0 overflow-hidden">
        <div className="border-b border-white/5 px-4 py-3 sm:px-5 flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white">
            Kayıtlar ({filteredItems.length}
            {search.trim() && filteredItems.length !== items.length ? ` / ${items.length}` : ""})
          </h2>
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            Sayfa {filter.page} / {totalPages}
          </span>
        </div>

        <div className="divide-y divide-white/5 min-w-0">
          {loading && items.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-10 text-[10px] font-black uppercase tracking-widest text-gray-500 sm:px-5">
              <Loader2 className="size-4 animate-spin text-[#7c3aed]" aria-hidden />
              Yükleniyor…
            </div>
          ) : isError ? (
            <p className="px-4 py-10 text-center text-[10px] font-semibold text-gray-500 sm:px-5">
              Kayıtlar yüklenemedi. Yukarıdaki hata bandından tekrar deneyin.
            </p>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-6 sm:px-5">
              <EmptyState
                variant={filterChips.length > 0 ? "filtered_empty" : "no_data"}
                icon={Inbox}
                title={
                  filterChips.length > 0 ? "Bu filtrelerde audit kaydı yok" : "Henüz audit kaydı yok"
                }
                description={
                  filterChips.length > 0
                    ? "Tarih aralığını genişletin veya filtreleri temizleyin."
                    : "Yönetim eylemleri burada listelenir."
                }
                primaryAction={
                  filterChips.length > 0
                    ? { label: "Filtreleri temizle", onClick: clearAllFilters }
                    : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {filteredItems.map((it) => {
                const metaEntries = metadataEntries(it.metadata);
                const previewEntries = metaEntries.slice(0, 3);
                const remaining = Math.max(0, metaEntries.length - previewEntries.length);
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(it)}
                      className="block w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40 sm:px-5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between min-w-0">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${actionToneClass(
                                it.action
                              )}`}
                            >
                              {actionLabel(it.action)}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-300">
                              {entityLabel(it.entityType)}
                            </span>
                            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                              {it.role || "—"}
                            </span>
                          </div>
                          <p className="text-xs font-black text-white break-words">{it.actorName}</p>
                          {previewEntries.length > 0 && (
                            <p className="text-[10px] font-semibold text-gray-500 break-words">
                              {previewEntries
                                .map((e) =>
                                  e.isComplex
                                    ? `${e.label}: …`
                                    : `${e.label}: ${metadataValueToString(e.value)}`
                                )
                                .join(" · ")}
                              {remaining > 0 ? ` · +${remaining} alan` : ""}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-500">
                          {formatDateTime(it.createdAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/5 px-4 py-3 sm:px-5">
          <DataTablePagination
            page={filter.page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={(nextPage) => setFilter((f) => ({ ...f, page: nextPage }))}
          />
        </div>
      </section>

      {selectedDetail && (
        <AuditDetailDrawer item={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}
    </div>
  );
}

function AuditDetailDrawer({
  item,
  onClose,
}: {
  item: AuditLogListItem;
  onClose: () => void;
}) {
  const entries = metadataEntries(item.metadata);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Audit kaydı detayı"
      className="fixed inset-0 z-50 flex items-stretch justify-end"
    >
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <aside className="relative ml-auto h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0e0e11] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0e0e11] px-5 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Audit detayı</p>
            <h2 className="text-sm font-black uppercase text-white break-words">{actionLabel(item.action)}</h2>
            <p className="text-[10px] font-semibold text-gray-500">
              {entityLabel(item.entityType)} · {formatDateTime(item.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-gray-300 hover:border-white/20 hover:text-white"
            aria-label="Detayı kapat"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <section className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Aktör</p>
            <p className="text-sm font-black text-white break-words">{item.actorName}</p>
            <p className="text-[10px] font-semibold text-gray-500">
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-300">
                {item.role || "—"}
              </span>
            </p>
            <p className="text-[10px] font-mono text-gray-400 break-all">User ID: {item.userId}</p>
            {item.organizationId ? (
              <p className="text-[10px] font-mono text-gray-400 break-all">Org ID: {item.organizationId}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Hedef</p>
            <p className="text-[11px] font-black text-white break-words">{entityLabel(item.entityType)}</p>
            <p className="text-[10px] font-mono text-gray-400 break-all">Entity ID: {item.entityId}</p>
            <p className="text-[10px] font-mono text-gray-500 break-all">Action key: {item.action}</p>
          </section>

          <section className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Metadata</p>
              <span className="text-[9px] font-bold text-gray-500">
                <ClipboardList size={11} className="mr-1 inline align-[-2px]" aria-hidden />
                {entries.length} alan
              </span>
            </div>
            {entries.length === 0 ? (
              <p className="text-[10px] font-semibold text-gray-500">Metadata yok.</p>
            ) : (
              <dl className="divide-y divide-white/5">
                {entries.map((e) => (
                  <div key={e.key} className="grid grid-cols-3 gap-2 py-2 text-[11px]">
                    <dt className="col-span-1 text-[10px] font-black uppercase tracking-widest text-gray-500 break-words">
                      {e.label}
                    </dt>
                    <dd className="col-span-2 min-w-0 break-words font-mono text-gray-200">
                      {e.isComplex ? (
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-[10px] text-gray-300">
                          {JSON.stringify(e.value, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-white">{metadataValueToString(e.value)}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
