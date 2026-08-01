import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { NAV_ITEM_IDS } from "./navigationEntitlementMap";
import { resolveNavigationEntitlementKey } from "./resolveNavigationEntitlement";

describe("resolveNavigationEntitlementKey", () => {
  it("resolves mapped navigation item ids", () => {
    expect(resolveNavigationEntitlementKey(NAV_ITEM_IDS.managementCoachPayments)).toBe(
      ENTITLEMENT_KEYS.finance
    );
    expect(resolveNavigationEntitlementKey(NAV_ITEM_IDS.managementAuditLog)).toBe(ENTITLEMENT_KEYS.audit);
    expect(resolveNavigationEntitlementKey(NAV_ITEM_IDS.athleteMyPrivatePackages)).toBe(
      ENTITLEMENT_KEYS.privateLessons
    );
  });

  it("returns entitlement for every registered nav item id", () => {
    for (const navItemId of Object.values(NAV_ITEM_IDS)) {
      expect(resolveNavigationEntitlementKey(navItemId)).not.toBeNull();
    }
  });
});
