import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveNavigationEntitlementKey } from "@/lib/organization/features/surfaces/resolveNavigationEntitlement";
import type { NavigationEntitlementMapKey } from "@/lib/organization/features/surfaces/navigationEntitlementMap";

export type NavigationFeatureDecision = "skip" | "allow" | "deny";

/**
 * organizationFeatures snapshot uzerinden nav item feature karari.
 * Map miss → skip (legacy visible).
 * organizationFeatures null → skip (henuz yuklenmedi).
 */
export function evaluateNavigationItemFeatureAccess(
  navItemId: NavigationEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): NavigationFeatureDecision {
  if (!navItemId || !organizationFeatures) {
    return "skip";
  }

  const entitlementKey = resolveNavigationEntitlementKey(navItemId);
  if (!entitlementKey) {
    return "skip";
  }

  return isEntitlementEnabled(organizationFeatures, entitlementKey) ? "allow" : "deny";
}

export function isNavigationItemFeatureVisible(
  navItemId: NavigationEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): boolean {
  const decision = evaluateNavigationItemFeatureAccess(navItemId, organizationFeatures);
  return decision !== "deny";
}
