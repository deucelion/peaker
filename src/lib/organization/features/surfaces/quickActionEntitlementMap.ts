import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Dashboard layout quick action kimligi → entitlement. */
export const QUICK_ACTION_IDS = {
  planGroupLesson: "quick_action:plan_group_lesson",
  planPrivateLesson: "quick_action:plan_private_lesson",
  openAttendance: "quick_action:open_attendance",
  addAthlete: "quick_action:add_athlete",
  recordPayment: "quick_action:record_payment",
  fieldTestEntry: "quick_action:field_test_entry",
} as const;

export type QuickActionEntitlementMapKey = (typeof QUICK_ACTION_IDS)[keyof typeof QUICK_ACTION_IDS];

export const QUICK_ACTION_ENTITLEMENT_MAP = {
  [QUICK_ACTION_IDS.planGroupLesson]: ENTITLEMENT_KEYS.core,
  [QUICK_ACTION_IDS.planPrivateLesson]: ENTITLEMENT_KEYS.privateLessons,
  [QUICK_ACTION_IDS.openAttendance]: ENTITLEMENT_KEYS.core,
  [QUICK_ACTION_IDS.addAthlete]: ENTITLEMENT_KEYS.core,
  [QUICK_ACTION_IDS.recordPayment]: ENTITLEMENT_KEYS.finance,
  [QUICK_ACTION_IDS.fieldTestEntry]: ENTITLEMENT_KEYS.insightFieldTests,
} as const satisfies Record<QuickActionEntitlementMapKey, EntitlementKey>;
