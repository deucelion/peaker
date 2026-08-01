"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { bumpClientRealtimeStat } from "@/lib/realtime/clientRealtimeStats";
import { subscribeFinanceTouches } from "@/lib/realtime/financeCrossTab";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { REALTIME_SUBSCRIPTION_IDS } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";
import { shouldSubscribeRealtime } from "@/lib/navigation/realtimeFeatureVisibility";

const DEBOUNCE_VISIBLE_MS = 900;
const DEBOUNCE_HIDDEN_MS = 4_000;

export type FinanceRealtimeSyncOptions = {
  /** Scoped org for this dashboard (URL override already applied server-side on load). */
  organizationId: string | null | undefined;
  enabled: boolean;
  organizationFeatures?: OrganizationFeatures | null;
  onInvalidate: () => void;
};

/**
 * Debounced invalidation: payments + PLP ledger + package events + cross-tab BroadcastChannel.
 * Single channel per mount; duplicate prevention per hook instance.
 */
export function useFinanceRealtimeSync({
  organizationId,
  enabled,
  organizationFeatures = null,
  onInvalidate,
}: FinanceRealtimeSyncOptions) {
  const debounceTimer = useRef<number | null>(null);
  const onInvalidateRef = useRef(onInvalidate);

  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  const schedule = useCallback(
    (source: string) => {
      void source;
      if (!organizationId) return;
      bumpClientRealtimeStat("financeInvalidate");
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const ms =
        typeof document !== "undefined" && document.visibilityState === "hidden" ? DEBOUNCE_HIDDEN_MS : DEBOUNCE_VISIBLE_MS;
      debounceTimer.current = window.setTimeout(() => {
        debounceTimer.current = null;
        onInvalidateRef.current();
      }, ms);
    },
    [organizationId]
  );

  useEffect(() => {
    const subscribeAllowed =
      enabled &&
      Boolean(organizationId) &&
      shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.financeSync, {
        roleAllowed: true,
        permissionAllowed: true,
        organizationFeatures,
      });
    if (!subscribeAllowed || !organizationId) return;

    const unsubs: Array<() => void> = [];

    const tables = ["payments", "private_lesson_payments", "private_lesson_package_events"] as const;
    const channel = supabase.channel(`finance-org-${organizationId}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          bumpClientRealtimeStat("financeRealtimeEvent");
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            schedule("pg-hidden");
            return;
          }
          schedule("pg");
        }
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        bumpClientRealtimeStat("reconnectNoted");
        bumpClientRealtimeStat("failedSubscription");
      }
      if (status === "SUBSCRIBED") bumpClientRealtimeStat("channelSubscribed");
    });
    unsubs.push(() => {
      void supabase.removeChannel(channel);
    });

    unsubs.push(
      subscribeFinanceTouches((orgFromTab) => {
        if (orgFromTab !== organizationId) return;
        bumpClientRealtimeStat("financeCrossTab");
        schedule("broadcast");
      })
    );

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      for (const u of unsubs) u();
    };
  }, [enabled, organizationId, organizationFeatures, schedule]);
}
