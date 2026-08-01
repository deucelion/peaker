import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveRealtimeEntitlementKey } from "@/lib/organization/features/surfaces/resolveRealtimeEntitlement";
import type { RealtimeEntitlementMapKey } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";

export type RealtimeFeatureDecision = "skip" | "allow" | "deny";

export type RealtimeFeatureDenial = {
  error: string;
  errorKind: "permission_denied";
};

const REALTIME_FEATURE_DENIED_MESSAGE = "Bu modul organizasyonunuz icin aktif degil." as const;

export function evaluateRealtimeFeatureAccess(
  realtimeSubscription: RealtimeEntitlementMapKey,
  features: OrganizationFeatures
): RealtimeFeatureDecision {
  const entitlementKey = resolveRealtimeEntitlementKey(realtimeSubscription);
  if (!entitlementKey) {
    return "skip";
  }
  return isEntitlementEnabled(features, entitlementKey) ? "allow" : "deny";
}

export async function assertRealtimeFeatureForOrg(
  realtimeSubscription: RealtimeEntitlementMapKey,
  organizationId: string | null
): Promise<RealtimeFeatureDenial | null> {
  const runtime = await getOrganizationFeatures(organizationId ?? "");
  const decision = evaluateRealtimeFeatureAccess(realtimeSubscription, runtime.features);
  if (decision === "deny") {
    return {
      error: REALTIME_FEATURE_DENIED_MESSAGE,
      errorKind: "permission_denied",
    };
  }
  return null;
}

export async function evaluateRealtimeFeatureAccessAfterPermissions(
  realtimeSubscription: RealtimeEntitlementMapKey,
  organizationId: string | null,
  permissionDenied: boolean
): Promise<RealtimeFeatureDecision> {
  if (permissionDenied) {
    return "skip";
  }
  const runtime = await getOrganizationFeatures(organizationId ?? "");
  return evaluateRealtimeFeatureAccess(realtimeSubscription, runtime.features);
}
