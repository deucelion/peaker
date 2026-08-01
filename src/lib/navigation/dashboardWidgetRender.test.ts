import { describe, expect, it } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { DASHBOARD_WIDGET_IDS } from "@/lib/organization/features/surfaces/widgetEntitlementMap";
import { shouldRenderDashboardWidget } from "@/lib/navigation/widgetFeatureVisibility";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function renderWidgetIds(
  features: ReturnType<typeof createClubProfessionalFeatures>,
  role: "admin" | "coach",
  permissionAllowed = true
) {
  const widgetIds = Object.values(DASHBOARD_WIDGET_IDS);
  return widgetIds.filter((widgetId) =>
    shouldRenderDashboardWidget(widgetId, {
      roleAllowed: role === "admin" ? widgetId.startsWith("widget:admin.") : widgetId.startsWith("widget:coach."),
      permissionAllowed,
      organizationFeatures: features,
    })
  );
}

describe("dashboard widget render assembly", () => {
  it("does not include denied finance widgets in admin render set", () => {
    const rendered = renderWidgetIds(createAllDisabledFeatures(), "admin");
    expect(rendered).not.toContain(DASHBOARD_WIDGET_IDS.adminRevenueCard);
    expect(rendered).not.toContain(DASHBOARD_WIDGET_IDS.adminTeamPayments);
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.adminStatsGrid);
  });

  it("includes allowed finance widgets in admin render set", () => {
    const rendered = renderWidgetIds(createClubProfessionalFeatures(), "admin");
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.adminRevenueCard);
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.adminTeamPayments);
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.adminOnboardingChecklist);
  });

  it("preserves Club Professional render parity for coach widgets", () => {
    const rendered = renderWidgetIds(createClubProfessionalFeatures(), "coach");
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.coachOpsMetrics);
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.coachNotificationsPreview);
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.coachPrivateSessions);
    expect(rendered).toContain(DASHBOARD_WIDGET_IDS.coachPerformanceBand);
  });

  it("omits denied communications widget from coach render set", () => {
    const rendered = renderWidgetIds(createAllDisabledFeatures(), "coach");
    expect(rendered).not.toContain(DASHBOARD_WIDGET_IDS.coachNotificationsPreview);
    expect(rendered).not.toContain(DASHBOARD_WIDGET_IDS.coachPrivateSessions);
    expect(rendered).not.toContain(DASHBOARD_WIDGET_IDS.coachPerformanceBand);
  });

  it("rejects duplicate widget ids at contract level", async () => {
    const { assertUniqueSurfaceMapKeys } = await import(
      "@/lib/organization/features/surfaces/contractValidation"
    );
    expect(() =>
      assertUniqueSurfaceMapKeys("DASHBOARD_WIDGET_IDS", Object.values(DASHBOARD_WIDGET_IDS))
    ).not.toThrow();
  });
});
