import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveRealtimeEntitlementKey } from "@/lib/organization/features/surfaces/resolveRealtimeEntitlement";
import type { RealtimeEntitlementMapKey } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";

export type RealtimeFeatureDecision = "skip" | "allow" | "deny";

/**
 * organizationFeatures snapshot uzerinden realtime feature karari.
 * Map miss → skip (legacy subscribe).
 * organizationFeatures null → skip (henuz yuklenmedi).
 */
export function evaluateRealtimeFeatureAccess(
  realtimeSubscription: RealtimeEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): RealtimeFeatureDecision {
  if (!realtimeSubscription || !organizationFeatures) {
    return "skip";
  }

  const entitlementKey = resolveRealtimeEntitlementKey(realtimeSubscription);
  if (!entitlementKey) {
    return "skip";
  }

  return isEntitlementEnabled(organizationFeatures, entitlementKey) ? "allow" : "deny";
}

export type RealtimeUiVisibilityContext = {
  roleAllowed: boolean;
  permissionAllowed: boolean;
  organizationFeatures: OrganizationFeatures | null;
};

export function shouldSubscribeRealtime(
  realtimeSubscription: RealtimeEntitlementMapKey,
  ctx: RealtimeUiVisibilityContext
): boolean {
  if (!ctx.roleAllowed) {
    return false;
  }
  if (!ctx.permissionAllowed) {
    return false;
  }
  return evaluateRealtimeFeatureAccess(realtimeSubscription, ctx.organizationFeatures) !== "deny";
}
