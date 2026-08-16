import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { SNAPSHOT_BRANCH_IDS } from "./snapshotEntitlementMap";
import { resolveSnapshotEntitlementKey } from "./resolveSnapshotEntitlement";

describe("resolveSnapshotEntitlementKey", () => {
  it("resolves mapped snapshot branch ids", () => {
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats)).toBe(
      ENTITLEMENT_KEYS.finance
    );
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.listMyNotifications)).toBe(
      ENTITLEMENT_KEYS.communications
    );
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.athletePanelDevelopmentHub)).toBe(
      ENTITLEMENT_KEYS.insightDevelopmentHub
    );
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.athletePanelBodyMeasurements)).toBe(
      ENTITLEMENT_KEYS.insightBodyMeasurements
    );
  });

  it("returns entitlement for every registered snapshot branch id", () => {
    for (const branchId of Object.values(SNAPSHOT_BRANCH_IDS)) {
      expect(resolveSnapshotEntitlementKey(branchId)).not.toBeNull();
    }
  });
});
