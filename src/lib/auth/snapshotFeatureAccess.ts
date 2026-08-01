import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveSnapshotEntitlementKey } from "@/lib/organization/features/surfaces/resolveSnapshotEntitlement";
import type { SnapshotEntitlementMapKey } from "@/lib/organization/features/surfaces/snapshotEntitlementMap";

export type SnapshotFeatureDecision = "skip" | "allow" | "deny";

export type SnapshotFeatureDenial = {
  error: string;
  errorKind: "permission_denied";
};

const SNAPSHOT_FEATURE_DENIED_MESSAGE = "Bu modul organizasyonunuz icin aktif degil." as const;

export function evaluateSnapshotBranchFeatureAccess(
  branchId: SnapshotEntitlementMapKey,
  features: OrganizationFeatures
): SnapshotFeatureDecision {
  const entitlementKey = resolveSnapshotEntitlementKey(branchId);
  if (!entitlementKey) {
    return "skip";
  }
  return isEntitlementEnabled(features, entitlementKey) ? "allow" : "deny";
}

export function isSnapshotBranchFeatureVisible(
  branchId: SnapshotEntitlementMapKey,
  features: OrganizationFeatures
): boolean {
  return evaluateSnapshotBranchFeatureAccess(branchId, features) !== "deny";
}

export async function loadSnapshotOrganizationFeatures(organizationId: string): Promise<OrganizationFeatures> {
  const runtime = await getOrganizationFeatures(organizationId);
  return runtime.features;
}

export async function evaluateSnapshotBranchFeatureAccessForOrg(
  branchId: SnapshotEntitlementMapKey,
  organizationId: string | null
): Promise<SnapshotFeatureDecision> {
  const features = await loadSnapshotOrganizationFeatures(organizationId ?? "");
  return evaluateSnapshotBranchFeatureAccess(branchId, features);
}

export async function assertSnapshotBranchFeatureForOrg(
  branchId: SnapshotEntitlementMapKey,
  organizationId: string | null
): Promise<SnapshotFeatureDenial | null> {
  const decision = await evaluateSnapshotBranchFeatureAccessForOrg(branchId, organizationId);
  if (decision === "deny") {
    return {
      error: SNAPSHOT_FEATURE_DENIED_MESSAGE,
      errorKind: "permission_denied",
    };
  }
  return null;
}

export async function evaluateSnapshotBranchFeatureAccessAfterPermissions(
  branchId: SnapshotEntitlementMapKey,
  organizationId: string | null,
  permissionDenied: boolean
): Promise<SnapshotFeatureDecision> {
  if (permissionDenied) {
    return "skip";
  }
  return evaluateSnapshotBranchFeatureAccessForOrg(branchId, organizationId);
}

export function optionalSnapshotBranchFields<T extends Record<string, unknown>>(
  branchId: SnapshotEntitlementMapKey,
  features: OrganizationFeatures,
  fields: T
): Partial<T> {
  if (!isSnapshotBranchFeatureVisible(branchId, features)) {
    return {};
  }
  return fields;
}
