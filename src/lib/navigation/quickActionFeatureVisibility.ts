import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveQuickActionEntitlementKey } from "@/lib/organization/features/surfaces/resolveQuickActionEntitlement";
import type { QuickActionEntitlementMapKey } from "@/lib/organization/features/surfaces/quickActionEntitlementMap";

export type QuickActionFeatureDecision = "skip" | "allow" | "deny";

/**
 * Quick action gorunurlugu yalnizca UI convenience'tir; guvenlik sinirini
 * route ve server action gate'leri belirler.
 * Map miss → skip (legacy visible).
 * organizationFeatures null + mapped action → deny (yuklenene kadar gizle).
 */
export function evaluateQuickActionFeatureAccess(
  quickActionId: QuickActionEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): QuickActionFeatureDecision {
  if (!quickActionId) {
    return "skip";
  }

  const entitlementKey = resolveQuickActionEntitlementKey(quickActionId);
  if (!entitlementKey) {
    return "skip";
  }

  if (!organizationFeatures) {
    return "deny";
  }

  return isEntitlementEnabled(organizationFeatures, entitlementKey) ? "allow" : "deny";
}

export function isQuickActionFeatureVisible(
  quickActionId: QuickActionEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): boolean {
  return evaluateQuickActionFeatureAccess(quickActionId, organizationFeatures) !== "deny";
}
