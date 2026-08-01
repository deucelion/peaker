import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import {
  assertOrganizationFeatureForAction,
  evaluateServerActionFeatureAccess,
  evaluateServerActionFeatureAccessAfterPermissions,
  isServerActionPermissionDeniedResult,
} from "@/lib/auth/serverActionFeatureAccess";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

vi.mock("@/lib/organization/features/runtime/metrics", () => ({
  emitOrganizationFeaturesRuntimeMetric: vi.fn(),
}));

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { emitOrganizationFeaturesRuntimeMetric } from "@/lib/organization/features/runtime/metrics";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

describe("serverActionFeatureAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips runtime for map miss", async () => {
    const decision = await evaluateServerActionFeatureAccess("unknown.action", "org-1");
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
    expect(emitOrganizationFeaturesRuntimeMetric).toHaveBeenCalledWith({ type: "feature_action_map_miss" });
  });

  it("allows mapped action when entitlement is enabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await evaluateServerActionFeatureAccess("finance.listOrgPaymentsForAdmin", "org-1");
    expect(decision).toBe("allow");
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
  });

  it("denies mapped action when entitlement is disabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 2,
      source: "database",
    });

    const decision = await evaluateServerActionFeatureAccess("audit.listAuditLogsForActor", "org-1");
    expect(decision).toBe("deny");
  });

  it("does not call runtime when permission phase failed", async () => {
    const decision = await evaluateServerActionFeatureAccessAfterPermissions(
      "finance.listOrgPaymentsForAdmin",
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

    const denial = await assertOrganizationFeatureForAction("finance.listOrgPaymentsForAdmin", "org-1");
    expect(denial).toBeNull();
  });

  it("returns permission_denied payload for feature denial", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const denial = await assertOrganizationFeatureForAction("finance.listOrgPaymentsForAdmin", "org-1");
    expect(denial).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("detects non-feature permission denied results", () => {
    expect(
      isServerActionPermissionDeniedResult({
        error: "Bu sayfa icin yetkiniz yok.",
        errorKind: "permission_denied",
      })
    ).toBe(true);
    expect(
      isServerActionPermissionDeniedResult({
        error: "Bu modul organizasyonunuz icin aktif degil.",
        errorKind: "permission_denied",
      })
    ).toBe(false);
  });
});
