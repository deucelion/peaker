import type { EntitlementKey } from "../types";

/** Surface map degerleri yalnizca canonical entitlement key olabilir. */
export type SurfaceEntitlementMap<TKey extends string> = Readonly<Record<TKey, EntitlementKey>>;
