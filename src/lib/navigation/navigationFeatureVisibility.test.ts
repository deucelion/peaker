import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { NAV_ITEM_IDS } from "@/lib/organization/features/surfaces/navigationEntitlementMap";
import {
  evaluateNavigationItemFeatureAccess,
  isNavigationItemFeatureVisible,
} from "@/lib/navigation/navigationFeatureVisibility";

vi.mock("@/lib/organization/features/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/organization/features/helpers")>();
  return {
    ...actual,
    isEntitlementEnabled: vi.fn(actual.isEntitlementEnabled),
  };
});

import { isEntitlementEnabled } from "@/lib/organization/features/helpers";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

describe("navigationFeatureVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows mapped navigation when entitlement is enabled", () => {
    const features = createClubProfessionalFeatures();
    expect(
      isNavigationItemFeatureVisible(NAV_ITEM_IDS.managementCoachPayments, features)
    ).toBe(true);
    expect(evaluateNavigationItemFeatureAccess(NAV_ITEM_IDS.managementCoachPayments, features)).toBe(
      "allow"
    );
  });

  it("hides mapped navigation when entitlement is disabled", () => {
    const features = createAllDisabledFeatures();
    expect(
      isNavigationItemFeatureVisible(NAV_ITEM_IDS.managementCoachPayments, features)
    ).toBe(false);
    expect(evaluateNavigationItemFeatureAccess(NAV_ITEM_IDS.managementCoachPayments, features)).toBe(
      "deny"
    );
  });

  it("denies mapped navigation while organizationFeatures is not yet loaded", () => {
    expect(evaluateNavigationItemFeatureAccess(NAV_ITEM_IDS.managementCoachPayments, null)).toBe("deny");
    expect(isNavigationItemFeatureVisible(NAV_ITEM_IDS.managementCoachPayments, null)).toBe(false);
    expect(isEntitlementEnabled).not.toHaveBeenCalled();
  });

  it("skips feature evaluation when navItemId is undefined", () => {
    expect(evaluateNavigationItemFeatureAccess(undefined, createClubProfessionalFeatures())).toBe("skip");
    expect(isEntitlementEnabled).not.toHaveBeenCalled();
  });

  it("uses Club Professional snapshot under kill-switch fallback payload", () => {
    const features = createClubProfessionalFeatures();
    expect(isNavigationItemFeatureVisible(NAV_ITEM_IDS.managementCollectionCenter, features)).toBe(true);
    expect(isNavigationItemFeatureVisible(NAV_ITEM_IDS.managementAuditLog, features)).toBe(true);
  });

  it("reuses the same organizationFeatures snapshot across multiple nav items", () => {
    const features = createAllDisabledFeatures();
    const items = [
      NAV_ITEM_IDS.managementCoachPayments,
      NAV_ITEM_IDS.managementCollectionCenter,
      NAV_ITEM_IDS.managementAuditLog,
    ];

    for (const navItemId of items) {
      expect(isNavigationItemFeatureVisible(navItemId, features)).toBe(false);
    }

    expect(isEntitlementEnabled).toHaveBeenCalledTimes(3);
    expect(isEntitlementEnabled).toHaveBeenCalledWith(features, expect.any(String));
  });
});
