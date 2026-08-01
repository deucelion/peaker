"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUnreadNotificationCount } from "@/lib/actions/notificationActions";
import { supabase } from "@/lib/supabase";
import { bumpClientRealtimeStat } from "@/lib/realtime/clientRealtimeStats";
import { useDocumentVisibility } from "@/lib/hooks/useDocumentVisibility";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { REALTIME_SUBSCRIPTION_IDS } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";
import { shouldSubscribeRealtime } from "@/lib/navigation/realtimeFeatureVisibility";

const MIN_FETCH_GAP_MS = 850;
const REALTIME_DEBOUNCE_MS = 450;
const POLL_VISIBLE_MS = 45_000;
const POLL_HIDDEN_MS = 120_000;

export type UseUnreadNotificationsLiveResult = {
  unreadCount: number;
  badgePulse: boolean;
  consumeBadgePulse: () => void;
};

/**
 * Navbar / shell: unread badge via server action count + Supabase Realtime (RLS user scope).
 * Throttle + hidden-tab aware polling fallback.
 */
export function useUnreadNotificationsLive(
  organizationFeatures: OrganizationFeatures | null = null
): UseUnreadNotificationsLiveResult {
  const visible = useDocumentVisibility();
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgePulse, setBadgePulse] = useState(false);

  const lastFetchAt = useRef(0);
  const lastAppliedCountRef = useRef(0);
  const realtimeTimer = useRef<number | null>(null);

  const consumeBadgePulse = useCallback(() => {
    setBadgePulse(false);
  }, []);

  const fetchCount = useCallback(async (reason: string) => {
    void reason;
    const now = Date.now();
    if (now - lastFetchAt.current < MIN_FETCH_GAP_MS) {
      bumpClientRealtimeStat("notificationFetchThrottled");
      return;
    }
    lastFetchAt.current = now;
    bumpClientRealtimeStat("notificationFetch");
    const res = await getUnreadNotificationCount();
    if ("error" in res) return;
    const next = res.count ?? 0;
    if (next > lastAppliedCountRef.current) setBadgePulse(true);
    lastAppliedCountRef.current = next;
    setUnreadCount(next);
  }, []);

  const scheduleRealtimeFetch = useCallback(() => {
    bumpClientRealtimeStat("notificationRealtimeEvent");
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    realtimeTimer.current = window.setTimeout(() => {
      realtimeTimer.current = null;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchCount("realtime");
    }, REALTIME_DEBOUNCE_MS);
  }, [fetchCount]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setUnreadCount(0);
        lastAppliedCountRef.current = 0;
        return;
      }
      void fetchCount("mount");
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCount]);

  useEffect(() => {
    if (!userId) return;
    const realtimeAllowed = shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.unreadNotifications, {
      roleAllowed: true,
      permissionAllowed: true,
      organizationFeatures,
    });
    if (!realtimeAllowed) return;

    const channel = supabase
      .channel(`notifications-global-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          scheduleRealtimeFetch();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          bumpClientRealtimeStat("reconnectNoted");
          bumpClientRealtimeStat("failedSubscription");
        }
        if (status === "SUBSCRIBED") bumpClientRealtimeStat("channelSubscribed");
      });

    const onManual = () => {
      void fetchCount("manual-event");
    };
    window.addEventListener("peaker-notifications-invalidate", onManual);

    return () => {
      window.removeEventListener("peaker-notifications-invalidate", onManual);
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchCount, scheduleRealtimeFetch, organizationFeatures]);

  useEffect(() => {
    if (!userId) return;
    const pollMs = visible ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
    const interval = window.setInterval(() => {
      void fetchCount("poll");
    }, pollMs);
    return () => window.clearInterval(interval);
  }, [userId, visible, fetchCount]);

  useEffect(() => {
    if (!badgePulse) return;
    const id = window.setTimeout(() => setBadgePulse(false), 2600);
    return () => clearTimeout(id);
  }, [badgePulse]);

  return { unreadCount, badgePulse, consumeBadgePulse };
}
