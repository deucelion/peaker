import { EXPORT_ENTITLEMENT_MAP } from "./exportEntitlementMap";
import type { ExportEntitlementMapKey } from "./exportEntitlementMap";
import type { EntitlementKey } from "../types";

/**
 * exportId → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveExportEntitlementKey(exportId: ExportEntitlementMapKey): EntitlementKey | null {
  return EXPORT_ENTITLEMENT_MAP[exportId] ?? null;
}
