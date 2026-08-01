import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { REALTIME_SUBSCRIPTION_IDS } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";
import { shouldSubscribeRealtime } from "@/lib/navigation/realtimeFeatureVisibility";

const channelMock = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((cb?: (status: string) => void) => {
    cb?.("SUBSCRIBED");
    return channelMock;
  }),
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function runFinanceSubscribeGuard(input: {
  organizationId: string | null;
  enabled: boolean;
  organizationFeatures: ReturnType<typeof createClubProfessionalFeatures> | ReturnType<typeof createAllDisabledFeatures>;
}) {
  const subscribeAllowed =
    input.enabled &&
    Boolean(input.organizationId) &&
    shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.financeSync, {
      roleAllowed: true,
      permissionAllowed: true,
      organizationFeatures: input.organizationFeatures,
    });
  if (!subscribeAllowed || !input.organizationId) return null;

  const channel = supabase.channel(`finance-org-${input.organizationId}`);
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "payments", filter: `organization_id=eq.${input.organizationId}` },
    () => {}
  );
  channel.subscribe(() => {});
  return channel;
}

describe("realtime subscription feature gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not subscribe when feature is denied", () => {
    runFinanceSubscribeGuard({
      organizationId: "org-1",
      enabled: true,
      organizationFeatures: createAllDisabledFeatures(),
    });
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("subscribes when feature is allowed", () => {
    runFinanceSubscribeGuard({
      organizationId: "org-1",
      enabled: true,
      organizationFeatures: createClubProfessionalFeatures(),
    });
    expect(supabase.channel).toHaveBeenCalledWith("finance-org-org-1");
    expect(channelMock.subscribe).toHaveBeenCalled();
  });

  it("preserves reconnect parity under Club Professional kill-switch snapshot", () => {
    runFinanceSubscribeGuard({
      organizationId: "org-1",
      enabled: true,
      organizationFeatures: createClubProfessionalFeatures(),
    });

    const subscribeCb = channelMock.subscribe.mock.calls[0]?.[0] as ((status: string) => void) | undefined;
    subscribeCb?.("CHANNEL_ERROR");
    subscribeCb?.("SUBSCRIBED");
    expect(channelMock.subscribe).toHaveBeenCalledTimes(1);
  });
});
