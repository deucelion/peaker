import { isEntitlementEnabled } from "@/lib/organization/features/helpers";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveExportEntitlementKey } from "@/lib/organization/features/surfaces/resolveExportEntitlement";
import type { ExportEntitlementMapKey } from "@/lib/organization/features/surfaces/exportEntitlementMap";

export type ExportFeatureDecision = "skip" | "allow" | "deny";

/**
 * organizationFeatures snapshot uzerinden export UI feature karari.
 * Map miss → skip (legacy render).
 * organizationFeatures null → skip (henuz yuklenmedi).
 */
export function evaluateExportFeatureAccess(
  exportId: ExportEntitlementMapKey | undefined,
  organizationFeatures: OrganizationFeatures | null
): ExportFeatureDecision {
  if (!exportId || !organizationFeatures) {
    return "skip";
  }

  const entitlementKey = resolveExportEntitlementKey(exportId);
  if (!entitlementKey) {
    return "skip";
  }

  return isEntitlementEnabled(organizationFeatures, entitlementKey) ? "allow" : "deny";
}

export type ExportUiVisibilityContext = {
  roleAllowed: boolean;
  permissionAllowed: boolean;
  organizationFeatures: OrganizationFeatures | null;
};

export function shouldRenderExportUi(
  exportId: ExportEntitlementMapKey,
  ctx: ExportUiVisibilityContext
): boolean {
  if (!ctx.roleAllowed) {
    return false;
  }
  if (!ctx.permissionAllowed) {
    return false;
  }
  return evaluateExportFeatureAccess(exportId, ctx.organizationFeatures) !== "deny";
}
