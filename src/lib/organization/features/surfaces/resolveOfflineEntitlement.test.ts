import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { OFFLINE_KIND_IDS } from "./offlineEntitlementMap";
import { resolveOfflineEntitlementKey } from "./resolveOfflineEntitlement";

describe("resolveOfflineEntitlementKey", () => {
  it("resolves mapped offline kind ids", () => {
    expect(resolveOfflineEntitlementKey(OFFLINE_KIND_IDS.wellnessDraft)).toBe(
      ENTITLEMENT_KEYS.insightWellnessArchive
    );
    expect(resolveOfflineEntitlementKey(OFFLINE_KIND_IDS.attendanceDraft)).toBe(ENTITLEMENT_KEYS.core);
    expect(resolveOfflineEntitlementKey("attendance_draft")).toBe(ENTITLEMENT_KEYS.core);
    expect(resolveOfflineEntitlementKey(OFFLINE_KIND_IDS.financeNoteDraft)).toBe(ENTITLEMENT_KEYS.finance);
  });

  it("returns entitlement for every registered offline kind id", () => {
    for (const offlineKindId of Object.values(OFFLINE_KIND_IDS)) {
      expect(resolveOfflineEntitlementKey(offlineKindId)).not.toBeNull();
    }
  });

  it("returns null for map miss (legacy offline path)", () => {
    expect(resolveOfflineEntitlementKey("offline:legacy.unmapped" as typeof OFFLINE_KIND_IDS.wellnessDraft)).toBeNull();
  });
});
