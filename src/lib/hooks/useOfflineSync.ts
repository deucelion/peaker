"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildOfflineScopeKey } from "@/lib/offline/scope";
import {
  countPendingOfflineActions,
  listOfflineActions,
  prepareOfflineQueueForScope,
} from "@/lib/offline/offlineActionQueue";
import { replayOfflineActions } from "@/lib/offline/replayOfflineActions";
import type { OfflineQueuedAction, OfflineReplayResult } from "@/lib/offline/types";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

export function useOfflineSync(scope: {
  organizationId: string | null | undefined;
  userId: string | null | undefined;
}) {
  const online = useOnlineStatus();
  const scopeKey = useMemo(
    () => buildOfflineScopeKey(scope.organizationId, scope.userId),
    [scope.organizationId, scope.userId]
  );
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<OfflineReplayResult | null>(null);
  const [items, setItems] = useState<OfflineQueuedAction[]>([]);

  const refresh = useCallback(() => {
    setItems(listOfflineActions(scopeKey));
    setPendingCount(countPendingOfflineActions(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    let cancelled = false;
    void prepareOfflineQueueForScope(scopeKey).then(() => {
      if (!cancelled) {
        setReady(true);
        refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scopeKey, refresh]);

  useEffect(() => {
    if (!ready) return;
    const onChange = () => refresh();
    window.addEventListener("peaker-offline-queue-changed", onChange);
    return () => window.removeEventListener("peaker-offline-queue-changed", onChange);
  }, [ready, refresh]);

  const runSync = useCallback(
    async (opts?: { includeConfirmation?: boolean; onlyIds?: string[] }) => {
      if (!online) return null;
      setSyncing(true);
      try {
        const result = await replayOfflineActions({
          scopeKey,
          includeConfirmation: opts?.includeConfirmation,
          onlyIds: opts?.onlyIds,
        });
        setLastResult(result);
        refresh();
        if (result.processed > 0) {
          window.setTimeout(() => setLastResult(null), 5000);
        }
        return result;
      } finally {
        setSyncing(false);
      }
    },
    [online, scopeKey, refresh]
  );

  useEffect(() => {
    if (!online || !ready || pendingCount === 0) return;
    const id = window.setTimeout(() => {
      void runSync();
    }, 800);
    return () => window.clearTimeout(id);
  }, [online, ready, pendingCount, runSync]);

  return {
    online,
    ready,
    scopeKey,
    pendingCount,
    syncing,
    items,
    lastResult,
    refresh,
    runSync,
  };
}
