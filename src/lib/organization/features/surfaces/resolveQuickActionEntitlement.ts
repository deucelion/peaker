import { QUICK_ACTION_ENTITLEMENT_MAP } from "./quickActionEntitlementMap";
import type { QuickActionEntitlementMapKey } from "./quickActionEntitlementMap";
import type { EntitlementKey } from "../types";

/**
 * quickActionId → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveQuickActionEntitlementKey(
  quickActionId: QuickActionEntitlementMapKey
): EntitlementKey | null {
  return QUICK_ACTION_ENTITLEMENT_MAP[quickActionId] ?? null;
}
