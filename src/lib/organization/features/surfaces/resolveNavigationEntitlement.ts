import { NAVIGATION_ENTITLEMENT_MAP } from "./navigationEntitlementMap";
import type { NavigationEntitlementMapKey } from "./navigationEntitlementMap";
import type { EntitlementKey } from "../types";

/**
 * navItemId → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveNavigationEntitlementKey(
  navItemId: NavigationEntitlementMapKey
): EntitlementKey | null {
  return NAVIGATION_ENTITLEMENT_MAP[navItemId] ?? null;
}
