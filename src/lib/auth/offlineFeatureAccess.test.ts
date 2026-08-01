import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { OFFLINE_KIND_IDS } from "@/lib/organization/features/surfaces/offlineEntitlementMap";
import {
  assertOfflineFeatureForOrg,
  evaluateOfflineFeatureAccess,
  evaluateOfflineFeatureAccessAfterPermissions,
} from "@/lib/auth/offlineFeatureAccess";
import { shouldAllowOfflineEnqueue, shouldRenderOfflineShell } from "@/lib/navigation/offlineFeatureVisibility";

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

describe("offlineFeatureAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows mapped offline kinds when entitlement is enabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await assertOfflineFeatureForOrg(OFFLINE_KIND_IDS.attendanceDraft, "org-1");
    expect(decision).toBeNull();
    expect(evaluateOfflineFeatureAccess("attendance_draft", createClubProfessionalFeatures())).toBe("allow");
  });

  it("denies mapped offline kinds when entitlement is disabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 2,
      source: "database",
    });

    const denial = await assertOfflineFeatureForOrg(OFFLINE_KIND_IDS.fieldTestDraft, "org-1");
    expect(denial).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("does not call runtime when permission phase failed", async () => {
    const decision = await evaluateOfflineFeatureAccessAfterPermissions(
      OFFLINE_KIND_IDS.wellnessDraft,
      "org-1",
      true
    );
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("blocks offline enqueue when role phase failed", () => {
    expect(
      shouldAllowOfflineEnqueue("wellness_draft", {
        roleAllowed: false,
        permissionAllowed: true,
        organizationFeatures: createAllDisabledFeatures(),
      })
    ).toBe(false);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("blocks offline enqueue when permission phase failed", () => {
    expect(
      shouldAllowOfflineEnqueue("rpe_draft", {
        roleAllowed: true,
        permissionAllowed: false,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(false);
  });

  it("uses Club Professional fallback when kill switch is OFF", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "kill_switch",
    });

    const denial = await assertOfflineFeatureForOrg(OFFLINE_KIND_IDS.financeNoteDraft, "org-1");
    expect(denial).toBeNull();
    expect(shouldRenderOfflineShell(createClubProfessionalFeatures())).toBe(true);
  });

  it("uses runtime fallback snapshot safely", () => {
    expect(evaluateOfflineFeatureAccess("coach_note_draft", createClubProfessionalFeatures())).toBe("allow");
  });

  it("skips feature evaluation for map miss (legacy offline)", () => {
    expect(
      evaluateOfflineFeatureAccess(
        "offline:legacy.unmapped" as typeof OFFLINE_KIND_IDS.wellnessDraft,
        createAllDisabledFeatures()
      )
    ).toBe("skip");
  });
});
