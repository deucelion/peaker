import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { evaluateProxyRouteFeatureAccess } from "@/lib/auth/proxyRouteFeatureAccess";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

vi.mock("@/lib/organization/features/runtime/metrics", () => ({
  emitOrganizationFeaturesRuntimeMetric: vi.fn(),
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

describe("evaluateProxyRouteFeatureAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips runtime lookup for ungated routes", async () => {
    const decision = await evaluateProxyRouteFeatureAccess("/login", "org-1");
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("allows gated routes when entitlement is enabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await evaluateProxyRouteFeatureAccess(PATHS.finans, "org-1");
    expect(decision).toBe("allow");
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
    expect(emitOrganizationFeaturesRuntimeMetric).toHaveBeenCalledWith({ type: "feature_route_allowed" });
  });

  it("denies gated routes when entitlement is disabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 2,
      source: "database",
    });

    const decision = await evaluateProxyRouteFeatureAccess(PATHS.finans, "org-1");
    expect(decision).toBe("deny");
    expect(emitOrganizationFeaturesRuntimeMetric).toHaveBeenCalledWith({ type: "feature_route_denied" });
  });

  it("uses Club Professional fallback snapshot when runtime resolves kill-switch behavior", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "kill_switch",
    });

    const decision = await evaluateProxyRouteFeatureAccess(PATHS.auditLog, "org-1");
    expect(decision).toBe("allow");
  });

  it("resolves dynamic package path before calling runtime", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await evaluateProxyRouteFeatureAccess(
      `${PATHS.ozelDersPaketleri}/660e8400-e29b-41d4-a716-446655440001`,
      "org-1"
    );
    expect(decision).toBe("deny");
  });
});
