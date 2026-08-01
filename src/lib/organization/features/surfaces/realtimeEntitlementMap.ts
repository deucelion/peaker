import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Realtime subscription kimligi → entitlement. */
export const REALTIME_SUBSCRIPTION_IDS = {
  unreadNotifications: "realtime:unread_notifications",
  financeSync: "realtime:finance_sync",
  liveAttendanceDashboard: "realtime:live_attendance_dashboard",
  orgPresenceCounts: "realtime:org_presence_counts",
} as const;

export type RealtimeEntitlementMapKey = (typeof REALTIME_SUBSCRIPTION_IDS)[keyof typeof REALTIME_SUBSCRIPTION_IDS];

export const REALTIME_ENTITLEMENT_MAP = {
  [REALTIME_SUBSCRIPTION_IDS.unreadNotifications]: ENTITLEMENT_KEYS.communications,
  [REALTIME_SUBSCRIPTION_IDS.financeSync]: ENTITLEMENT_KEYS.finance,
  [REALTIME_SUBSCRIPTION_IDS.liveAttendanceDashboard]: ENTITLEMENT_KEYS.core,
  [REALTIME_SUBSCRIPTION_IDS.orgPresenceCounts]: ENTITLEMENT_KEYS.core,
} as const satisfies Record<RealtimeEntitlementMapKey, EntitlementKey>;
