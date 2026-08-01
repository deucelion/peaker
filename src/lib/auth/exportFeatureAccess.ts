import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveExportEntitlementKey } from "@/lib/organization/features/surfaces/resolveExportEntitlement";
import type { ExportEntitlementMapKey } from "@/lib/organization/features/surfaces/exportEntitlementMap";

export type ExportFeatureDecision = "skip" | "allow" | "deny";

export type ExportFeatureDenial = {
  error: string;
  errorKind: "permission_denied";
};

const EXPORT_FEATURE_DENIED_MESSAGE = "Bu modul organizasyonunuz icin aktif degil." as const;

export function evaluateExportFeatureAccess(
  exportId: ExportEntitlementMapKey,
  features: OrganizationFeatures
): ExportFeatureDecision {
  const entitlementKey = resolveExportEntitlementKey(exportId);
  if (!entitlementKey) {
    return "skip";
  }
  return isEntitlementEnabled(features, entitlementKey) ? "allow" : "deny";
}

export async function assertExportFeatureForOrg(
  exportId: ExportEntitlementMapKey,
  organizationId: string | null
): Promise<ExportFeatureDenial | null> {
  const runtime = await getOrganizationFeatures(organizationId ?? "");
  const decision = evaluateExportFeatureAccess(exportId, runtime.features);
  if (decision === "deny") {
    return {
      error: EXPORT_FEATURE_DENIED_MESSAGE,
      errorKind: "permission_denied",
    };
  }
  return null;
}

export async function evaluateExportFeatureAccessAfterPermissions(
  exportId: ExportEntitlementMapKey,
  organizationId: string | null,
  permissionDenied: boolean
): Promise<ExportFeatureDecision> {
  if (permissionDenied) {
    return "skip";
  }
  const runtime = await getOrganizationFeatures(organizationId ?? "");
  return evaluateExportFeatureAccess(exportId, runtime.features);
}
