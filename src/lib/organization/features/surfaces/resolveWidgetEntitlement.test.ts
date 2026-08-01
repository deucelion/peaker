import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { DASHBOARD_WIDGET_IDS } from "./widgetEntitlementMap";
import { resolveWidgetEntitlementKey } from "./resolveWidgetEntitlement";

describe("resolveWidgetEntitlementKey", () => {
  it("resolves mapped dashboard widget ids", () => {
    expect(resolveWidgetEntitlementKey(DASHBOARD_WIDGET_IDS.adminRevenueCard)).toBe(ENTITLEMENT_KEYS.finance);
    expect(resolveWidgetEntitlementKey(DASHBOARD_WIDGET_IDS.coachNotificationsPreview)).toBe(
      ENTITLEMENT_KEYS.communications
    );
    expect(resolveWidgetEntitlementKey(DASHBOARD_WIDGET_IDS.coachPerformanceBand)).toBe(
      ENTITLEMENT_KEYS.insightPerformance
    );
  });

  it("returns entitlement for every registered widget id", () => {
    for (const widgetId of Object.values(DASHBOARD_WIDGET_IDS)) {
      expect(resolveWidgetEntitlementKey(widgetId)).not.toBeNull();
    }
  });
});
