import { SNAPSHOT_ENTITLEMENT_MAP } from "./snapshotEntitlementMap";
import type { SnapshotEntitlementMapKey } from "./snapshotEntitlementMap";
import type { EntitlementKey } from "../types";

/**
 * snapshotBranchId → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveSnapshotEntitlementKey(branchId: SnapshotEntitlementMapKey): EntitlementKey | null {
  return SNAPSHOT_ENTITLEMENT_MAP[branchId] ?? null;
}
