"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { bumpClientRealtimeStat } from "@/lib/realtime/clientRealtimeStats";

const DEBOUNCE_MS = 1_200;

export type LiveAttendanceDashboardOptions = {
  enabled: boolean;
  /** Called after debounce; use soft refresh that avoids full-page loading UX. */
  onSoftRefresh: () => void;
};

/**
 * Subscribes to training_participants changes visible under RLS (coach/admin org scope).
 * Debounced; coalesces bursts. When tab hidden, marks pending and runs once on visible.
 */
export function useLiveAttendanceDashboard({ enabled, onSoftRefresh }: LiveAttendanceDashboardOptions) {
  const pendingHidden = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const onSoftRefreshRef = useRef(onSoftRefresh);

  useEffect(() => {
    onSoftRefreshRef.current = onSoftRefresh;
  }, [onSoftRefresh]);

  const fire = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      pendingHidden.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      onSoftRefreshRef.current();
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!pendingHidden.current) return;
      pendingHidden.current = false;
      onSoftRefreshRef.current();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`attendance-participants-live`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "training_participants" },
        () => {
          bumpClientRealtimeStat("attendanceRealtimeEvent");
          fire();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          bumpClientRealtimeStat("reconnectNoted");
          bumpClientRealtimeStat("failedSubscription");
        }
        if (status === "SUBSCRIBED") bumpClientRealtimeStat("channelSubscribed");
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, fire]);
}
