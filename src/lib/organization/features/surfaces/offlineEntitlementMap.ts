import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Offline queue kind → entitlement (OfflineActionKind ile hizali). */
export const OFFLINE_KIND_IDS = {
  wellnessDraft: "offline:wellness_draft",
  rpeDraft: "offline:rpe_draft",
  attendanceDraft: "offline:attendance_draft",
  fieldTestDraft: "offline:field_test_draft",
  coachNoteDraft: "offline:coach_note_draft",
  financeNoteDraft: "offline:finance_note_draft",
  paymentRecordDraft: "offline:payment_record_draft",
  privateLessonCompleteDraft: "offline:private_lesson_complete_draft",
  packageLifecycleDraft: "offline:package_lifecycle_draft",
} as const;

export type OfflineEntitlementMapKey = (typeof OFFLINE_KIND_IDS)[keyof typeof OFFLINE_KIND_IDS];

export const OFFLINE_ENTITLEMENT_MAP = {
  [OFFLINE_KIND_IDS.wellnessDraft]: ENTITLEMENT_KEYS.insightWellnessArchive,
  [OFFLINE_KIND_IDS.rpeDraft]: ENTITLEMENT_KEYS.athlete,
  [OFFLINE_KIND_IDS.attendanceDraft]: ENTITLEMENT_KEYS.core,
  [OFFLINE_KIND_IDS.fieldTestDraft]: ENTITLEMENT_KEYS.insightFieldTests,
  [OFFLINE_KIND_IDS.coachNoteDraft]: ENTITLEMENT_KEYS.core,
  [OFFLINE_KIND_IDS.financeNoteDraft]: ENTITLEMENT_KEYS.finance,
  [OFFLINE_KIND_IDS.paymentRecordDraft]: ENTITLEMENT_KEYS.finance,
  [OFFLINE_KIND_IDS.privateLessonCompleteDraft]: ENTITLEMENT_KEYS.privateLessons,
  [OFFLINE_KIND_IDS.packageLifecycleDraft]: ENTITLEMENT_KEYS.privateLessons,
} as const satisfies Record<OfflineEntitlementMapKey, EntitlementKey>;
