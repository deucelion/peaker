import { OFFLINE_ENTITLEMENT_MAP, OFFLINE_KIND_IDS } from "./offlineEntitlementMap";
import type { OfflineEntitlementMapKey } from "./offlineEntitlementMap";
import type { OfflineActionKind } from "@/lib/offline/types";
import type { EntitlementKey } from "../types";

const OFFLINE_ACTION_KIND_TO_MAP_KEY = {
  wellness_draft: OFFLINE_KIND_IDS.wellnessDraft,
  rpe_draft: OFFLINE_KIND_IDS.rpeDraft,
  attendance_draft: OFFLINE_KIND_IDS.attendanceDraft,
  field_test_draft: OFFLINE_KIND_IDS.fieldTestDraft,
  coach_note_draft: OFFLINE_KIND_IDS.coachNoteDraft,
  finance_note_draft: OFFLINE_KIND_IDS.financeNoteDraft,
  payment_record_draft: OFFLINE_KIND_IDS.paymentRecordDraft,
  private_lesson_complete_draft: OFFLINE_KIND_IDS.privateLessonCompleteDraft,
  package_lifecycle_draft: OFFLINE_KIND_IDS.packageLifecycleDraft,
} as const satisfies Record<OfflineActionKind, OfflineEntitlementMapKey>;

export function offlineEntitlementMapKeyFromActionKind(kind: OfflineActionKind): OfflineEntitlementMapKey {
  return OFFLINE_ACTION_KIND_TO_MAP_KEY[kind];
}

/**
 * offlineKind → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveOfflineEntitlementKey(
  offlineKind: OfflineEntitlementMapKey | OfflineActionKind
): EntitlementKey | null {
  const mapKey =
    typeof offlineKind === "string" && offlineKind.startsWith("offline:")
      ? (offlineKind as OfflineEntitlementMapKey)
      : offlineEntitlementMapKeyFromActionKind(offlineKind as OfflineActionKind);
  return OFFLINE_ENTITLEMENT_MAP[mapKey] ?? null;
}
