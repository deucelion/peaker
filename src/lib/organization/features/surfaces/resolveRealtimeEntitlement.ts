import { REALTIME_ENTITLEMENT_MAP } from "./realtimeEntitlementMap";
import type { RealtimeEntitlementMapKey } from "./realtimeEntitlementMap";
import type { EntitlementKey } from "../types";

/**
 * realtimeSubscription → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveRealtimeEntitlementKey(
  realtimeSubscription: RealtimeEntitlementMapKey
): EntitlementKey | null {
  return REALTIME_ENTITLEMENT_MAP[realtimeSubscription] ?? null;
}
