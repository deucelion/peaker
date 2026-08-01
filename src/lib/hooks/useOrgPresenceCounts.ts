"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bumpClientRealtimeStat } from "@/lib/realtime/clientRealtimeStats";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { REALTIME_SUBSCRIPTION_IDS } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";
import { shouldSubscribeRealtime } from "@/lib/navigation/realtimeFeatureVisibility";

export type OrgPresenceRole = "admin" | "coach";

export type OrgPresenceCounts = {
  adminOnline: number;
  coachOnline: number;
};

/**
 * Coarse org presence (counts only). Requires authenticated dashboard user.
 * Stops when organizationId or role missing.
 */
export function useOrgPresenceCounts(
  organizationId: string | null,
  presenceRole: OrgPresenceRole | null,
  organizationFeatures: OrganizationFeatures | null = null
) {
  const [liveCounts, setLiveCounts] = useState<OrgPresenceCounts>({ adminOnline: 0, coachOnline: 0 });

  useEffect(() => {
    const subscribeAllowed =
      Boolean(organizationId && presenceRole) &&
      shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.orgPresenceCounts, {
        roleAllowed: true,
        permissionAllowed: true,
        organizationFeatures,
      });
    if (!subscribeAllowed) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      const ch = supabase.channel(`presence:org:${organizationId}`, {
        config: { presence: { key: uid } },
      });
      channel = ch;

      ch.on("presence", { event: "sync" }, () => {
        bumpClientRealtimeStat("presenceSync");
        const state = ch.presenceState() as Record<string, Array<{ role?: string }>>;
        let adminOnline = 0;
        let coachOnline = 0;
        for (const metas of Object.values(state)) {
          const row = Array.isArray(metas) ? metas[0] : metas;
          if (row?.role === "admin") adminOnline += 1;
          else if (row?.role === "coach") coachOnline += 1;
        }
        setLiveCounts({ adminOnline, coachOnline });
      });

      ch.subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          await ch.track({ role: presenceRole, at: Date.now() });
        }
        if (status === "CHANNEL_ERROR") {
          bumpClientRealtimeStat("reconnectNoted");
          bumpClientRealtimeStat("failedSubscription");
        }
        if (status === "SUBSCRIBED") bumpClientRealtimeStat("channelSubscribed");
      });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [organizationId, presenceRole, organizationFeatures]);

  return useMemo(() => {
    if (!organizationId || !presenceRole) return { adminOnline: 0, coachOnline: 0 };
    return liveCounts;
  }, [organizationId, presenceRole, liveCounts]);
}
