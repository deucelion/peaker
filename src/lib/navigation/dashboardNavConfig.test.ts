import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";
import {
  DASHBOARD_NAV_ITEMS,
  isDashboardNavItemVisible,
  type DashboardNavItem,
} from "@/lib/navigation/dashboardNavConfig";
import { NAV_ITEM_IDS } from "@/lib/organization/features/surfaces/navigationEntitlementMap";

vi.mock("@/lib/navigation/navigationFeatureVisibility", () => ({
  isNavigationItemFeatureVisible: vi.fn(() => true),
}));

import { isNavigationItemFeatureVisible } from "@/lib/navigation/navigationFeatureVisibility";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function findNavItem(navItemId: (typeof NAV_ITEM_IDS)[keyof typeof NAV_ITEM_IDS]): DashboardNavItem {
  const item = DASHBOARD_NAV_ITEMS.find((entry) => entry.navItemId === navItemId);
  if (!item) {
    throw new Error(`Missing nav item for ${navItemId}`);
  }
  return item;
}

describe("isDashboardNavItemVisible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNavigationItemFeatureVisible).mockReturnValue(true);
  });

  it("shows mapped finance nav for admin when feature is enabled", () => {
    const item = findNavItem(NAV_ITEM_IDS.managementCollectionCenter);
    vi.mocked(isNavigationItemFeatureVisible).mockReturnValueOnce(true);

    expect(
      isDashboardNavItemVisible(item, {
        role: "admin",
        coachPermissions: null,
        athletePermissions: null,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(true);
    expect(isNavigationItemFeatureVisible).toHaveBeenCalledWith(
      NAV_ITEM_IDS.managementCollectionCenter,
      expect.any(Object)
    );
  });

  it("hides mapped finance nav for admin when feature is disabled", () => {
    const item = findNavItem(NAV_ITEM_IDS.managementCollectionCenter);
    vi.mocked(isNavigationItemFeatureVisible).mockReturnValueOnce(false);

    expect(
      isDashboardNavItemVisible(item, {
        role: "admin",
        coachPermissions: null,
        athletePermissions: null,
        organizationFeatures: createAllDisabledFeatures(),
      })
    ).toBe(false);
  });

  it("does not evaluate features when role fails", () => {
    const item = findNavItem(NAV_ITEM_IDS.managementCollectionCenter);

    expect(
      isDashboardNavItemVisible(item, {
        role: "sporcu",
        coachPermissions: null,
        athletePermissions: DEFAULT_ATHLETE_PERMISSIONS,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(false);
    expect(isNavigationItemFeatureVisible).not.toHaveBeenCalled();
  });

  it("does not evaluate features when coach permission fails", () => {
    const item = findNavItem(NAV_ITEM_IDS.managementCoachPayments);

    expect(
      isDashboardNavItemVisible(item, {
        role: "coach",
        coachPermissions: { ...DEFAULT_COACH_PERMISSIONS, can_view_reports: false },
        athletePermissions: null,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(false);
    expect(isNavigationItemFeatureVisible).not.toHaveBeenCalled();
  });

  it("does not evaluate features when athlete permission fails", () => {
    const item = findNavItem(NAV_ITEM_IDS.athleteNotifications);

    expect(
      isDashboardNavItemVisible(item, {
        role: "sporcu",
        coachPermissions: null,
        athletePermissions: { ...DEFAULT_ATHLETE_PERMISSIONS, can_view_notifications: false },
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(false);
    expect(isNavigationItemFeatureVisible).not.toHaveBeenCalled();
  });

  it("allows core nav items when organizationFeatures is null (pre-bootstrap legacy)", () => {
    const item = findNavItem(NAV_ITEM_IDS.managementHome);
    vi.mocked(isNavigationItemFeatureVisible).mockReturnValueOnce(true);

    expect(
      isDashboardNavItemVisible(item, {
        role: "admin",
        coachPermissions: null,
        athletePermissions: null,
        organizationFeatures: null,
      })
    ).toBe(true);
    expect(isNavigationItemFeatureVisible).toHaveBeenCalledWith(NAV_ITEM_IDS.managementHome, null);
  });

  it("regresses permission-only coach finance nav visibility", () => {
    const item = findNavItem(NAV_ITEM_IDS.managementCoachPayments);
    vi.mocked(isNavigationItemFeatureVisible).mockReturnValueOnce(true);

    expect(
      isDashboardNavItemVisible(item, {
        role: "coach",
        coachPermissions: { ...DEFAULT_COACH_PERMISSIONS, can_view_reports: true },
        athletePermissions: null,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(true);
  });
});

describe("dashboard nav map parity", () => {
  it("registers every dashboard nav item in NAVIGATION_ENTITLEMENT_MAP", () => {
    expect(DASHBOARD_NAV_ITEMS.length).toBe(Object.values(NAV_ITEM_IDS).length);
    for (const item of DASHBOARD_NAV_ITEMS) {
      expect(Object.values(NAV_ITEM_IDS)).toContain(item.navItemId);
    }
  });
});
