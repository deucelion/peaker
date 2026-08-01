import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { SNAPSHOT_BRANCH_IDS } from "@/lib/organization/features/surfaces/snapshotEntitlementMap";
import {
  assertSnapshotBranchFeatureForOrg,
  evaluateSnapshotBranchFeatureAccess,
  evaluateSnapshotBranchFeatureAccessAfterPermissions,
  isSnapshotBranchFeatureVisible,
} from "@/lib/auth/snapshotFeatureAccess";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

describe("snapshotFeatureAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows mapped branches when entitlement is enabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await assertSnapshotBranchFeatureForOrg(
      SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats,
      "org-1"
    );
    expect(decision).toBeNull();
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
  });

  it("denies mapped branches when entitlement is disabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 2,
      source: "database",
    });

    const denial = await assertSnapshotBranchFeatureForOrg(
      SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats,
      "org-1"
    );
    expect(denial).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("does not call runtime when permission phase failed", async () => {
    const decision = await evaluateSnapshotBranchFeatureAccessAfterPermissions(
      SNAPSHOT_BRANCH_IDS.listMyNotifications,
      "org-1",
      true
    );
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("does not call runtime when role phase failed", async () => {
    const decision = await evaluateSnapshotBranchFeatureAccessAfterPermissions(
      SNAPSHOT_BRANCH_IDS.listMyNotifications,
      "org-1",
      true
    );
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("uses Club Professional fallback when kill switch is OFF", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "kill_switch",
    });

    expect(
      isSnapshotBranchFeatureVisible(
        SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats,
        createClubProfessionalFeatures()
      )
    ).toBe(true);

    const denial = await assertSnapshotBranchFeatureForOrg(
      SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats,
      "org-1"
    );
    expect(denial).toBeNull();
  });

  it("uses runtime fallback snapshot safely", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "repository_error_fallback",
    });

    const decision = await evaluateSnapshotBranchFeatureAccess(
      SNAPSHOT_BRANCH_IDS.dashboardCoachNotifications,
      createClubProfessionalFeatures()
    );
    expect(decision).toBe("allow");
  });
});
