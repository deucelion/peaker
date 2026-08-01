"use client";

import { useState } from "react";
import { useOfflineSync } from "@/lib/hooks/useOfflineSync";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { SyncStatusBadge } from "@/components/offline/SyncStatusBadge";
import { SyncStatusCenter } from "@/components/offline/SyncStatusCenter";
import { OfflineActionToast } from "@/components/offline/OfflineActionToast";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import type { OrganizationFeatures } from "@/lib/organization/features/types";

export function DashboardOfflineShell({
  organizationId,
  userId,
  organizationFeatures = null,
}: {
  organizationId: string | null;
  userId: string | null;
  organizationFeatures?: OrganizationFeatures | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { online, scopeKey, pendingCount, syncing, items, lastResult, refresh, runSync, offlineShellEnabled } =
    useOfflineSync({
      organizationId,
      userId,
      organizationFeatures,
    });

  if (!offlineShellEnabled) {
    return (
      <>
        <ServiceWorkerRegister />
        <PwaInstallBanner />
      </>
    );
  }

  return (
    <>
      <ServiceWorkerRegister />
      <PwaInstallBanner />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!online ? <OfflineBanner pendingCount={pendingCount} /> : null}
        <SyncStatusBadge
          online={online}
          pendingCount={pendingCount}
          syncing={syncing}
          onOpenPending={() => setDrawerOpen(true)}
        />
      </div>
      <SyncStatusCenter
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={items}
        scopeKey={scopeKey}
        syncing={syncing}
        lastResult={lastResult}
        onRefresh={refresh}
        onRetry={() => void runSync()}
        onRetryWithConfirmation={() => void runSync({ includeConfirmation: true })}
        onRetryOne={(id) => {
          const item = items.find((i) => i.id === id);
          const needsConfirm = item?.status === "requires_confirmation";
          void runSync({ onlyIds: [id], includeConfirmation: needsConfirm });
        }}
        onConfirmOne={(id) => void runSync({ onlyIds: [id], includeConfirmation: true })}
      />
      <OfflineActionToast result={lastResult} />
    </>
  );
}
