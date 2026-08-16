import { describe, expect, it } from "vitest";
import { resolveQuickActionEntitlementKey } from "./resolveQuickActionEntitlement";
import { QUICK_ACTION_ENTITLEMENT_MAP, QUICK_ACTION_IDS } from "./quickActionEntitlementMap";
import { ENTITLEMENT_KEYS } from "../keys";

describe("resolveQuickActionEntitlementKey", () => {
  it("resolves the finance entitlement for payment recording", () => {
    expect(resolveQuickActionEntitlementKey(QUICK_ACTION_IDS.recordPayment)).toBe(
      ENTITLEMENT_KEYS.finance
    );
  });

  it("resolves the field test entitlement for field test entry", () => {
    expect(resolveQuickActionEntitlementKey(QUICK_ACTION_IDS.fieldTestEntry)).toBe(
      ENTITLEMENT_KEYS.insightFieldTests
    );
  });

  it("resolves the private lessons entitlement for private lesson planning", () => {
    expect(resolveQuickActionEntitlementKey(QUICK_ACTION_IDS.planPrivateLesson)).toBe(
      ENTITLEMENT_KEYS.privateLessons
    );
  });

  it("resolves every quick action id in the map", () => {
    for (const quickActionId of Object.values(QUICK_ACTION_IDS)) {
      expect(resolveQuickActionEntitlementKey(quickActionId)).toBe(
        QUICK_ACTION_ENTITLEMENT_MAP[quickActionId]
      );
    }
  });

  it("returns null for an unmapped quick action id", () => {
    expect(
      resolveQuickActionEntitlementKey("quick_action:unknown" as never)
    ).toBeNull();
  });
});
