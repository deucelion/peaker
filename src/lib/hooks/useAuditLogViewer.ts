"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listAuditLogsForActor } from "@/lib/actions/auditLogActions";
import type { AuditLogListItem } from "@/lib/actions/auditLogTypes";
import { debugAuditLogFetch } from "@/lib/audit/auditDiagnostics";
import { useMountedRef } from "@/lib/hooks/useMountedRef";
import { deriveQueryStatus, normalizeErrorKind, type QueryErrorKind, type QueryStatus } from "@/lib/ui/queryState";

export type AuditLogFilterState = {
  action: string;
  entityType: string;
  fromIso: string;
  toIso: string;
  page: number;
};

function auditDefaultDateRange(): Pick<AuditLogFilterState, "fromIso" | "toIso"> {
  const d = new Date();
  const to = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  const fromDate = new Date(d);
  fromDate.setDate(fromDate.getDate() - 29);
  const from = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()))
    .toISOString()
    .slice(0, 10);
  return { fromIso: from, toIso: to };
}

/** FAZ 21 — Varsayılan son 30 gün (tüm tarihler ağır sorgu / timeout riski). */
export const AUDIT_LOG_DEFAULT_FILTER: AuditLogFilterState = {
  action: "",
  entityType: "",
  ...auditDefaultDateRange(),
  page: 1,
};

export const AUDIT_LOG_PAGE_SIZE = 50;

export function useAuditLogViewer() {
  const mountedRef = useMountedRef();
  const fetchGenRef = useRef(0);
  const [filter, setFilter] = useState<AuditLogFilterState>(AUDIT_LOG_DEFAULT_FILTER);
  const [items, setItems] = useState<AuditLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<QueryErrorKind | null>(null);
  const [diagnosticsCode, setDiagnosticsCode] = useState<string | null>(null);
  const [scopeOrgId, setScopeOrgId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    setDiagnosticsCode(null);
    debugAuditLogFetch("fetch.start", { page: filter.page, gen });

    try {
      const res = await listAuditLogsForActor({
        action: filter.action || null,
        entityType: filter.entityType || null,
        fromIso: filter.fromIso || null,
        toIso: filter.toIso || null,
        page: filter.page,
        pageSize: AUDIT_LOG_PAGE_SIZE,
      });
      if (!mountedRef.current || gen !== fetchGenRef.current) return;

      if ("error" in res) {
        setItems([]);
        setTotal(0);
        const kind = normalizeErrorKind("errorKind" in res ? res.errorKind : null);
        setError(typeof res.error === "string" ? res.error : "Audit kayıtları alınamadı.");
        setErrorKind(kind);
        setDiagnosticsCode("diagnosticsCode" in res && res.diagnosticsCode ? res.diagnosticsCode : null);
        debugAuditLogFetch("fetch.error", { kind, gen, diagnosticsCode: res.diagnosticsCode });
        return;
      }

      setDiagnosticsCode(null);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setScopeOrgId(res.scope?.organizationId ?? null);
      debugAuditLogFetch("fetch.ok", { total: res.total, items: res.items?.length ?? 0, gen });
    } catch (e) {
      if (!mountedRef.current || gen !== fetchGenRef.current) return;
      setItems([]);
      setTotal(0);
      setError("Audit kayıtları şu anda alınamıyor. Bağlantınızı kontrol edip tekrar deneyin.");
      setErrorKind("fetch_error");
      setDiagnosticsCode("AUD-FETCH_ERROR");
      debugAuditLogFetch("fetch.throw", { gen, message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (!mountedRef.current || gen !== fetchGenRef.current) return;
      setLoading(false);
    }
  }, [filter, mountedRef]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const updateFilter = useCallback((updater: (prev: AuditLogFilterState) => AuditLogFilterState) => {
    setFilter(updater);
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(AUDIT_LOG_DEFAULT_FILTER);
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE)),
    [total]
  );

  const status: QueryStatus = useMemo(
    () =>
      deriveQueryStatus({
        loading,
        hasError: Boolean(error),
        hasData: items.length > 0,
      }),
    [loading, error, items.length]
  );

  const isEmpty = status === "empty";
  const isError = status === "error";

  return {
    filter,
    items,
    total,
    totalPages,
    loading,
    error,
    errorKind,
    diagnosticsCode,
    status,
    isEmpty,
    isError,
    scopeOrgId,
    refetch: fetchData,
    setFilter: updateFilter,
    resetFilter,
  };
}
