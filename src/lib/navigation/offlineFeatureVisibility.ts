import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { OFFLINE_KIND_IDS } from "@/lib/organization/features/surfaces/offlineEntitlementMap";
import { resolveOfflineEntitlementKey } from "@/lib/organization/features/surfaces/resolveOfflineEntitlement";
import type { OfflineEntitlementMapKey } from "@/lib/organization/features/surfaces/offlineEntitlementMap";
import type { OfflineActionKind } from "@/lib/offline/types";

export type OfflineFeatureDecision = "skip" | "allow" | "deny";

/**
 * organizationFeatures snapshot uzerinden offline feature karari.
 * Map miss → skip (legacy).
 * organizationFeatures null → skip (henuz yuklenmedi).
 */
export function evaluateOfflineFeatureAccess(
  offlineKind: OfflineEntitlementMapKey | OfflineActionKind | undefined,
  organizationFeatures: OrganizationFeatures | null
): OfflineFeatureDecision {
  if (!offlineKind || !organizationFeatures) {
    return "skip";
  }

  const entitlementKey = resolveOfflineEntitlementKey(offlineKind);
  if (!entitlementKey) {
    return "skip";
  }

  return isEntitlementEnabled(organizationFeatures, entitlementKey) ? "allow" : "deny";
}

export type OfflineUiVisibilityContext = {
  roleAllowed: boolean;
  permissionAllowed: boolean;
  organizationFeatures: OrganizationFeatures | null;
};

export function shouldAllowOfflineEnqueue(
  offlineKind: OfflineActionKind,
  ctx: OfflineUiVisibilityContext
): boolean {
  if (!ctx.roleAllowed) {
    return false;
  }
  if (!ctx.permissionAllowed) {
    return false;
  }
  return evaluateOfflineFeatureAccess(offlineKind, ctx.organizationFeatures) !== "deny";
}

export function shouldRenderOfflineShell(organizationFeatures: OrganizationFeatures | null): boolean {
  if (!organizationFeatures) {
    return true;
  }
  return Object.values(OFFLINE_KIND_IDS).some(
    (offlineKindId) => evaluateOfflineFeatureAccess(offlineKindId, organizationFeatures) !== "deny"
  );
}
