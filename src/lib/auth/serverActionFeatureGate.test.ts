import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { runServerActionWithFeatureGate } from "@/lib/auth/serverActionFeatureGate";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

describe("runServerActionWithFeatureGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSessionActor).mockResolvedValue({
      actor: {
        id: "user-1",
        role: "admin",
        organizationId: "org-1",
        isActive: true,
        fullName: "Admin",
      },
    });
  });

  it("does not call runtime when action returns permission denied", async () => {
    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", async () => ({
      error: "Bu sayfa icin yetkiniz yok.",
      errorKind: "permission_denied" as const,
    }));

    expect(result).toEqual({
      error: "Bu sayfa icin yetkiniz yok.",
      errorKind: "permission_denied",
    });
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("allows unmapped actions without runtime lookup", async () => {
    const result = await runServerActionWithFeatureGate("unknown.action", async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("runs explicit feature assert after permissions with correct org id", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", async (ctx) => {
      const denial = await ctx.assertOrganizationFeature("org-1");
      if (denial) return denial;
      return { ok: true };
    });

    expect(result).toEqual({ ok: true });
    expect(getOrganizationFeatures).toHaveBeenCalledTimes(1);
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
  });

  it("auto-gates successful mapped actions when explicit assert is omitted", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const result = await runServerActionWithFeatureGate("audit.listAuditLogsForActor", async () => ({ ok: true }));
    expect(result).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
  });

  it("allows mapped actions under kill-switch fallback", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "kill_switch",
    });

    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", async () => ({
      ok: true,
    }));
    expect(result).toEqual({ ok: true });
  });
});
