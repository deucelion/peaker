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
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { shouldRenderOfflineShell } from "@/lib/navigation/offlineFeatureVisibility";

export function useOfflineSync(scope: {
  organizationId: string | null | undefined;
  userId: string | null | undefined;
  organizationFeatures?: OrganizationFeatures | null;
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
  const offlineShellEnabled = shouldRenderOfflineShell(scope.organizationFeatures ?? null);

  const refresh = useCallback(() => {
    setItems(listOfflineActions(scopeKey));
    setPendingCount(countPendingOfflineActions(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    if (!offlineShellEnabled) return;
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
  }, [offlineShellEnabled, scopeKey, refresh]);

  useEffect(() => {
    if (!offlineShellEnabled || !ready) return;
    const onChange = () => refresh();
    window.addEventListener("peaker-offline-queue-changed", onChange);
    return () => window.removeEventListener("peaker-offline-queue-changed", onChange);
  }, [offlineShellEnabled, ready, refresh]);

  const runSync = useCallback(
    async (opts?: { includeConfirmation?: boolean; onlyIds?: string[] }) => {
      if (!online || !offlineShellEnabled) return null;
      setSyncing(true);
      try {
        const result = await replayOfflineActions({
          scopeKey,
          includeConfirmation: opts?.includeConfirmation,
          onlyIds: opts?.onlyIds,
          organizationFeatures: scope.organizationFeatures ?? null,
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
    [online, offlineShellEnabled, scope.organizationFeatures, scopeKey, refresh]
  );

  useEffect(() => {
    if (!online || !ready || !offlineShellEnabled || pendingCount === 0) return;
    const id = window.setTimeout(() => {
      void runSync();
    }, 800);
    return () => window.clearTimeout(id);
  }, [online, ready, offlineShellEnabled, pendingCount, runSync]);

  return {
    online,
    ready: offlineShellEnabled ? ready : false,
    offlineShellEnabled,
    scopeKey,
    pendingCount,
    syncing,
    items,
    lastResult,
    refresh,
    runSync,
  };
}
