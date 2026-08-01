import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { DASHBOARD_WIDGET_IDS } from "@/lib/organization/features/surfaces/widgetEntitlementMap";
import {
  evaluateWidgetFeatureAccess,
  isDashboardWidgetFeatureVisible,
  shouldRenderDashboardWidget,
} from "@/lib/navigation/widgetFeatureVisibility";

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

describe("widgetFeatureVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows mapped widgets when entitlement is enabled", () => {
    const features = createClubProfessionalFeatures();
    expect(evaluateWidgetFeatureAccess(DASHBOARD_WIDGET_IDS.adminRevenueCard, features)).toBe("allow");
    expect(isDashboardWidgetFeatureVisible(DASHBOARD_WIDGET_IDS.coachPrivateSessions, features)).toBe(true);
  });

  it("denies mapped widgets when entitlement is disabled", () => {
    const features = createAllDisabledFeatures();
    expect(evaluateWidgetFeatureAccess(DASHBOARD_WIDGET_IDS.adminRevenueCard, features)).toBe("deny");
    expect(isDashboardWidgetFeatureVisible(DASHBOARD_WIDGET_IDS.coachNotificationsPreview, features)).toBe(false);
  });

  it("skips feature evaluation when organizationFeatures is null", () => {
    expect(evaluateWidgetFeatureAccess(DASHBOARD_WIDGET_IDS.adminRevenueCard, null)).toBe("skip");
    expect(isEntitlementEnabled).not.toHaveBeenCalled();
  });

  it("does not evaluate features when role fails", () => {
    expect(
      shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminRevenueCard, {
        roleAllowed: false,
        permissionAllowed: true,
        organizationFeatures: createAllDisabledFeatures(),
      })
    ).toBe(false);
    expect(isEntitlementEnabled).not.toHaveBeenCalled();
  });

  it("does not evaluate features when permission fails", () => {
    expect(
      shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.coachPerformanceBand, {
        roleAllowed: true,
        permissionAllowed: false,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(false);
    expect(isEntitlementEnabled).not.toHaveBeenCalled();
  });

  it("uses Club Professional snapshot under kill-switch fallback payload", () => {
    const features = createClubProfessionalFeatures();
    expect(
      shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminTeamPayments, {
        roleAllowed: true,
        permissionAllowed: true,
        organizationFeatures: features,
      })
    ).toBe(true);
  });

  it("allows legacy render when organizationFeatures is not yet loaded", () => {
    expect(
      shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminRevenueCard, {
        roleAllowed: true,
        permissionAllowed: true,
        organizationFeatures: null,
      })
    ).toBe(true);
  });
});
