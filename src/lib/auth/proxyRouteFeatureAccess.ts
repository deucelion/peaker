import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { emitOrganizationFeaturesRuntimeMetric } from "@/lib/organization/features/runtime/metrics";
import { resolveRouteEntitlementKey } from "@/lib/organization/features/surfaces/resolveRouteEntitlement";

export type ProxyRouteFeatureDecision = "skip" | "allow" | "deny";

export async function evaluateProxyRouteFeatureAccess(
  pathname: string,
  organizationId: string | null
): Promise<ProxyRouteFeatureDecision> {
  const entitlementKey = resolveRouteEntitlementKey(pathname);
  if (!entitlementKey) {
    return "skip";
  }

  const runtime = await getOrganizationFeatures(organizationId ?? "");
  const allowed = isEntitlementEnabled(runtime.features, entitlementKey);

  emitOrganizationFeaturesRuntimeMetric({
    type: allowed ? "feature_route_allowed" : "feature_route_denied",
  });

  return allowed ? "allow" : "deny";
}
