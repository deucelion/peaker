import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveOfflineEntitlementKey } from "@/lib/organization/features/surfaces/resolveOfflineEntitlement";
import type { OfflineEntitlementMapKey } from "@/lib/organization/features/surfaces/offlineEntitlementMap";
import type { OfflineActionKind } from "@/lib/offline/types";

export type OfflineFeatureDecision = "skip" | "allow" | "deny";

export type OfflineFeatureDenial = {
  error: string;
  errorKind: "permission_denied";
};

const OFFLINE_FEATURE_DENIED_MESSAGE = "Bu modul organizasyonunuz icin aktif degil." as const;

export function evaluateOfflineFeatureAccess(
  offlineKind: OfflineEntitlementMapKey | OfflineActionKind,
  features: OrganizationFeatures
): OfflineFeatureDecision {
  const entitlementKey = resolveOfflineEntitlementKey(offlineKind);
  if (!entitlementKey) {
    return "skip";
  }
  return isEntitlementEnabled(features, entitlementKey) ? "allow" : "deny";
}

export async function assertOfflineFeatureForOrg(
  offlineKind: OfflineEntitlementMapKey | OfflineActionKind,
  organizationId: string | null
): Promise<OfflineFeatureDenial | null> {
  const runtime = await getOrganizationFeatures(organizationId ?? "");
  const decision = evaluateOfflineFeatureAccess(offlineKind, runtime.features);
  if (decision === "deny") {
    return {
      error: OFFLINE_FEATURE_DENIED_MESSAGE,
      errorKind: "permission_denied",
    };
  }
  return null;
}

export async function evaluateOfflineFeatureAccessAfterPermissions(
  offlineKind: OfflineEntitlementMapKey | OfflineActionKind,
  organizationId: string | null,
  permissionDenied: boolean
): Promise<OfflineFeatureDecision> {
  if (permissionDenied) {
    return "skip";
  }
  const runtime = await getOrganizationFeatures(organizationId ?? "");
  return evaluateOfflineFeatureAccess(offlineKind, runtime.features);
}
