"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAuditLogsForActor,
  type AuditLogListItem,
} from "@/lib/actions/auditLogActions";
import { normalizeErrorKind, type QueryErrorKind } from "@/lib/ui/queryState";

/**
 * Faz 7.1 — Audit log viewer için ortak orchestration hook.
 *
 * Page component'i bu hook'u tüketerek lifecycle yönetimini delege eder:
 *   - filter state
 *   - loading / error state
 *   - error kind normalize
 *   - refetch helper
 *
 * Davranışsal değişiklik yok; sadece state organizasyonu page'den hook'a taşındı.
 */

export type AuditLogFilterState = {
  action: string;
  entityType: string;
  fromIso: string;
  toIso: string;
  page: number;
};

export const AUDIT_LOG_DEFAULT_FILTER: AuditLogFilterState = {
  action: "",
  entityType: "",
  fromIso: "",
  toIso: "",
  page: 1,
};

export const AUDIT_LOG_PAGE_SIZE = 50;

export function useAuditLogViewer() {
  const [filter, setFilter] = useState<AuditLogFilterState>(AUDIT_LOG_DEFAULT_FILTER);
  const [items, setItems] = useState<AuditLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<QueryErrorKind | null>(null);
  const [scopeOrgId, setScopeOrgId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorKind(null);
    const res = await listAuditLogsForActor({
      action: filter.action || null,
      entityType: filter.entityType || null,
      fromIso: filter.fromIso || null,
      toIso: filter.toIso || null,
      page: filter.page,
      pageSize: AUDIT_LOG_PAGE_SIZE,
    });
    if ("error" in res) {
      setItems([]);
      setTotal(0);
      setError(typeof res.error === "string" ? res.error : "Audit kayıtları alınamadı.");
      setErrorKind(normalizeErrorKind("errorKind" in res ? res.errorKind : null));
      setLoading(false);
      return;
    }
    setItems(res.items ?? []);
    setTotal(res.total ?? 0);
    setScopeOrgId(res.scope?.organizationId ?? null);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchData is the canonical loader; mirrors original page behavior
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

  return {
    filter,
    items,
    total,
    totalPages,
    loading,
    error,
    errorKind,
    scopeOrgId,
    refetch: fetchData,
    setFilter: updateFilter,
    resetFilter,
  };
}
