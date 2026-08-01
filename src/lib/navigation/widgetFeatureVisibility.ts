import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveWidgetEntitlementKey } from "@/lib/organization/features/surfaces/resolveWidgetEntitlement";
import type { WidgetEntitlementMapKey } from "@/lib/organization/features/surfaces/widgetEntitlementMap";

export type WidgetFeatureDecision = "skip" | "allow" | "deny";

/**
 * organizationFeatures snapshot uzerinden widget feature karari.
 * Map miss → skip (legacy render).
 * organizationFeatures null → skip (henuz yuklenmedi).
 */
export function evaluateWidgetFeatureAccess(
  widgetId: WidgetEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): WidgetFeatureDecision {
  if (!widgetId || !organizationFeatures) {
    return "skip";
  }

  const entitlementKey = resolveWidgetEntitlementKey(widgetId);
  if (!entitlementKey) {
    return "skip";
  }

  return isEntitlementEnabled(organizationFeatures, entitlementKey) ? "allow" : "deny";
}

export function isDashboardWidgetFeatureVisible(
  widgetId: WidgetEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): boolean {
  return evaluateWidgetFeatureAccess(widgetId, organizationFeatures) !== "deny";
}

export type DashboardWidgetVisibilityContext = {
  roleAllowed: boolean;
  permissionAllowed: boolean;
  organizationFeatures: OrganizationFeatures | null;
};

export function shouldRenderDashboardWidget(
  widgetId: WidgetEntitlementMapKey,
  ctx: DashboardWidgetVisibilityContext
): boolean {
  if (!ctx.roleAllowed) {
    return false;
  }
  if (!ctx.permissionAllowed) {
    return false;
  }
  return isDashboardWidgetFeatureVisible(widgetId, ctx.organizationFeatures);
}
