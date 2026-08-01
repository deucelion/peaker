import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { REALTIME_SUBSCRIPTION_IDS } from "./realtimeEntitlementMap";
import { resolveRealtimeEntitlementKey } from "./resolveRealtimeEntitlement";

describe("resolveRealtimeEntitlementKey", () => {
  it("resolves mapped realtime subscription ids", () => {
    expect(resolveRealtimeEntitlementKey(REALTIME_SUBSCRIPTION_IDS.financeSync)).toBe(
      ENTITLEMENT_KEYS.finance
    );
    expect(resolveRealtimeEntitlementKey(REALTIME_SUBSCRIPTION_IDS.unreadNotifications)).toBe(
      ENTITLEMENT_KEYS.communications
    );
    expect(resolveRealtimeEntitlementKey(REALTIME_SUBSCRIPTION_IDS.liveAttendanceDashboard)).toBe(
      ENTITLEMENT_KEYS.core
    );
  });

  it("returns entitlement for every registered realtime subscription id", () => {
    for (const subscriptionId of Object.values(REALTIME_SUBSCRIPTION_IDS)) {
      expect(resolveRealtimeEntitlementKey(subscriptionId)).not.toBeNull();
    }
  });

  it("returns null for map miss (legacy subscribe path)", () => {
    expect(
      resolveRealtimeEntitlementKey("realtime:legacy.unmapped" as typeof REALTIME_SUBSCRIPTION_IDS.financeSync)
    ).toBeNull();
  });
});
