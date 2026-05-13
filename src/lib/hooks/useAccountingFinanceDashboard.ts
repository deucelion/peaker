"use client";

import { useCallback, useMemo, useState } from "react";
import type { AccountingFinanceFilters, AccountingFinanceSnapshot } from "@/lib/actions/accountingFinanceActions";
import { loadAccountingFinanceDashboard } from "@/lib/actions/accountingFinanceActions";
import type { QueryErrorKind } from "@/lib/ui/queryState";

/**
 * Faz 8.6 — Accounting/Finance dashboard fetch lifecycle foundation.
 *
 * Hedef:
 *   - muhasebe-finans/page.tsx içindeki tekrarlanan fetch + loading/error
 *     pattern'ini sarmalamak.
 *   - Optimistic update / modal orchestration ayrı hook'lara bırakıldı (Faz 9).
 *
 * Davranış parity:
 *   - Page kademeli geçebilir; mevcut fetch fonksiyonlarıyla aynı sözleşme.
 */

function monthKeyNow() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type UseAccountingFinanceDashboardOptions = {
  initialFilters?: AccountingFinanceFilters;
};

export type UseAccountingFinanceDashboardReturn = {
  snapshot: AccountingFinanceSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  loadError: string | null;
  loadErrorKind: QueryErrorKind | null;
  appliedFilters: AccountingFinanceFilters;
  setAppliedFilters: (filters: AccountingFinanceFilters) => void;
  refresh: (overrideFilters?: AccountingFinanceFilters) => Promise<void>;
  clearError: () => void;
};

export function useAccountingFinanceDashboard(
  options?: UseAccountingFinanceDashboardOptions
): UseAccountingFinanceDashboardReturn {
  const initial = useMemo<AccountingFinanceFilters>(
    () => options?.initialFilters ?? { month: monthKeyNow() },
    [options?.initialFilters]
  );
  const [appliedFilters, setAppliedFilters] = useState<AccountingFinanceFilters>(initial);
  const [snapshot, setSnapshot] = useState<AccountingFinanceSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorKind, setLoadErrorKind] = useState<QueryErrorKind | null>(null);

  const refresh = useCallback(
    async (overrideFilters?: AccountingFinanceFilters) => {
      const filters = overrideFilters ?? appliedFilters;
      if (snapshot) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      setLoadErrorKind(null);
      try {
        const result = await loadAccountingFinanceDashboard(filters);
        if ("error" in result) {
          setLoadError(result.error);
          // loadAccountingFinanceDashboard şu an `errorKind` döndürmüyor;
          // mesaj tarayıcı tabanlı tahmin yerine güvenli default kullanılır.
          setLoadErrorKind(/yetkiniz/i.test(result.error) ? "permission_denied" : "fetch_error");
          return;
        }
        setSnapshot(result.snapshot);
        if (overrideFilters) setAppliedFilters(overrideFilters);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedFilters, snapshot]
  );

  const clearError = useCallback(() => {
    setLoadError(null);
    setLoadErrorKind(null);
  }, []);

  return {
    snapshot,
    loading,
    refreshing,
    loadError,
    loadErrorKind,
    appliedFilters,
    setAppliedFilters,
    refresh,
    clearError,
  };
}
