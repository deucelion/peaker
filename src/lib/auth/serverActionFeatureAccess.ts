import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { emitOrganizationFeaturesRuntimeMetric } from "@/lib/organization/features/runtime/metrics";
import { resolveActionNamespaceEntitlementKey } from "@/lib/organization/features/surfaces/resolveActionNamespaceEntitlement";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

export type ServerActionFeatureDecision = "skip" | "allow" | "deny";

export type ServerActionFeatureDenial = {
  error: string;
  errorKind: "permission_denied";
};

const ORGANIZATION_FEATURE_DENIED_MESSAGE =
  "Bu modul organizasyonunuz icin aktif degil." as const;

export function isServerActionFeatureDenial(value: unknown): value is ServerActionFeatureDenial {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string" &&
    (value as { errorKind?: unknown }).errorKind === "permission_denied" &&
    (value as { error?: unknown }).error === ORGANIZATION_FEATURE_DENIED_MESSAGE
  );
}

export function isServerActionPermissionDeniedResult(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string" &&
    (value as { errorKind?: unknown }).errorKind === "permission_denied" &&
    !isServerActionFeatureDenial(value)
  );
}

export async function evaluateServerActionFeatureAccess(
  actionName: string,
  organizationId: string | null
): Promise<ServerActionFeatureDecision> {
  const entitlementKey = resolveActionNamespaceEntitlementKey(actionName);
  if (!entitlementKey) {
    emitOrganizationFeaturesRuntimeMetric({ type: "feature_action_map_miss" });
    return "skip";
  }

  const runtime = await getOrganizationFeatures(organizationId ?? "");
  const allowed = isEntitlementEnabled(runtime.features, entitlementKey);

  emitOrganizationFeaturesRuntimeMetric({
    type: allowed ? "feature_action_allowed" : "feature_action_denied",
  });

  return allowed ? "allow" : "deny";
}

export async function assertOrganizationFeatureForAction(
  actionName: string,
  organizationId: string | null
): Promise<ServerActionFeatureDenial | null> {
  const decision = await evaluateServerActionFeatureAccess(actionName, organizationId);
  if (decision === "deny") {
    return {
      error: ORGANIZATION_FEATURE_DENIED_MESSAGE,
      errorKind: "permission_denied",
    };
  }
  return null;
}

export async function evaluateServerActionFeatureAccessAfterPermissions(
  actionName: string,
  organizationId: string | null,
  permissionDenied: boolean
): Promise<ServerActionFeatureDecision> {
  if (permissionDenied) {
    return "skip";
  }
  return evaluateServerActionFeatureAccess(actionName, organizationId);
}

export async function peekOrganizationIdForServerAction(): Promise<string | null> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) {
    return null;
  }
  return resolved.actor.organizationId;
}
