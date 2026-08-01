import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { REALTIME_SUBSCRIPTION_IDS } from "@/lib/organization/features/surfaces/realtimeEntitlementMap";
import {
  assertRealtimeFeatureForOrg,
  evaluateRealtimeFeatureAccess,
  evaluateRealtimeFeatureAccessAfterPermissions,
} from "@/lib/auth/realtimeFeatureAccess";
import { shouldSubscribeRealtime } from "@/lib/navigation/realtimeFeatureVisibility";

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

describe("realtimeFeatureAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows mapped subscriptions when entitlement is enabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await assertRealtimeFeatureForOrg(REALTIME_SUBSCRIPTION_IDS.financeSync, "org-1");
    expect(decision).toBeNull();
    expect(
      evaluateRealtimeFeatureAccess(REALTIME_SUBSCRIPTION_IDS.unreadNotifications, createClubProfessionalFeatures())
    ).toBe("allow");
  });

  it("denies mapped subscriptions when entitlement is disabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 2,
      source: "database",
    });

    const denial = await assertRealtimeFeatureForOrg(REALTIME_SUBSCRIPTION_IDS.financeSync, "org-1");
    expect(denial).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("does not call runtime when permission phase failed", async () => {
    const decision = await evaluateRealtimeFeatureAccessAfterPermissions(
      REALTIME_SUBSCRIPTION_IDS.orgPresenceCounts,
      "org-1",
      true
    );
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("does not subscribe when role phase failed", () => {
    expect(
      shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.financeSync, {
        roleAllowed: false,
        permissionAllowed: true,
        organizationFeatures: createAllDisabledFeatures(),
      })
    ).toBe(false);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("does not subscribe when permission phase failed", () => {
    expect(
      shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.unreadNotifications, {
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

    const denial = await assertRealtimeFeatureForOrg(REALTIME_SUBSCRIPTION_IDS.orgPresenceCounts, "org-1");
    expect(denial).toBeNull();
    expect(
      shouldSubscribeRealtime(REALTIME_SUBSCRIPTION_IDS.financeSync, {
        roleAllowed: true,
        permissionAllowed: true,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(true);
  });

  it("uses runtime fallback snapshot safely", () => {
    expect(
      evaluateRealtimeFeatureAccess(REALTIME_SUBSCRIPTION_IDS.liveAttendanceDashboard, createClubProfessionalFeatures())
    ).toBe("allow");
  });
});
