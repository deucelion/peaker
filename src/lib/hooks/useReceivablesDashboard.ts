"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ReceivableDashboardFilters,
  ReceivableDashboardSnapshot,
} from "@/lib/actions/receivableDashboardActions";
import { loadReceivablesDashboard } from "@/lib/actions/receivableDashboardActions";
import type { QueryErrorKind } from "@/lib/ui/queryState";

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useReceivablesDashboard() {
  const initial = useMemo<ReceivableDashboardFilters>(() => ({ month: monthKeyNow() }), []);
  const [applied, setApplied] = useState<ReceivableDashboardFilters>(initial);
  const [snapshot, setSnapshot] = useState<ReceivableDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorKind, setLoadErrorKind] = useState<QueryErrorKind | null>(null);

  const refresh = useCallback(
    async (override?: ReceivableDashboardFilters) => {
      const filters = override ?? applied;
      if (snapshot) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      setLoadErrorKind(null);
      try {
        const result = await loadReceivablesDashboard(filters);
        if ("error" in result) {
          setLoadError(result.error);
          setLoadErrorKind(/yetkiniz/i.test(result.error) ? "permission_denied" : "fetch_error");
          return;
        }
        setSnapshot(result.snapshot);
        if (override) setApplied(override);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applied, snapshot]
  );

  return {
    snapshot,
    loading,
    refreshing,
    loadError,
    loadErrorKind,
    appliedFilters: applied,
    setAppliedFilters: setApplied,
    refresh,
  };
}
