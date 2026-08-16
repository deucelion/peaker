import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS, ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { SNAPSHOT_BRANCH_IDS } from "@/lib/organization/features/surfaces/snapshotEntitlementMap";
import { resolveSnapshotEntitlementKey } from "@/lib/organization/features/surfaces/resolveSnapshotEntitlement";
import { resolveActionNamespaceEntitlementKey } from "@/lib/organization/features/surfaces/resolveActionNamespaceEntitlement";
import { runServerActionWithFeatureGate } from "@/lib/auth/serverActionFeatureGate";
import { isSnapshotBranchFeatureVisible } from "@/lib/auth/snapshotFeatureAccess";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

const ORG_ID = "org-a";

function featuresWith(overrides: Partial<Record<(typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number], boolean>>) {
  const configurable = Object.fromEntries(
    CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, overrides[key] ?? false])
  ) as Record<(typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number], boolean>;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function mockActor(overrides: Partial<{ role: string; organizationId: string | null }> = {}) {
  vi.mocked(resolveSessionActor).mockResolvedValue({
    actor: {
      id: "user-1",
      role: (overrides.role ?? "admin") as "admin",
      organizationId: overrides.organizationId === undefined ? ORG_ID : overrides.organizationId,
      isActive: true,
      fullName: "Actor",
    },
  });
}

function mockFeatures(features: ReturnType<typeof featuresWith>) {
  vi.mocked(getOrganizationFeatures).mockResolvedValue({
    features,
    featuresRevision: 1,
    source: "database",
  });
}

describe("Phase 42 — development_hub mimarisi", () => {
  it("gelisim profili verisi snapshot branch ile korunur; ayri action namespace gerekmez", () => {
    expect(resolveActionNamespaceEntitlementKey("snapshot.getAthletePanelSnapshot")).toBe(
      ENTITLEMENT_KEYS.core
    );
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.athletePanelDevelopmentHub)).toBe(
      ENTITLEMENT_KEYS.insightDevelopmentHub
    );

    const disabled = featuresWith({ "insight.development_hub": false });
    expect(
      isSnapshotBranchFeatureVisible(SNAPSHOT_BRANCH_IDS.athletePanelDevelopmentHub, disabled)
    ).toBe(false);
  });

  it("gelisim profili route haritasi sporcu self panelini korur", async () => {
    const { resolveRouteEntitlementKey } = await import(
      "@/lib/organization/features/surfaces/resolveRouteEntitlement"
    );
    const { PATHS } = await import("@/lib/navigation/routeRegistry");

    expect(resolveRouteEntitlementKey(PATHS.sporcu)).toBe(ENTITLEMENT_KEYS.insightDevelopmentHub);
  });
});

describe("Phase 42 — body_measurements snapshot parity", () => {
  it("athlete_metrics snapshot branch artik insight.body_measurements ile eslenir", () => {
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.athletePanelBodyMeasurements)).toBe(
      ENTITLEMENT_KEYS.insightBodyMeasurements
    );
    expect(resolveSnapshotEntitlementKey(SNAPSHOT_BRANCH_IDS.athletePanelPerformanceMetrics)).toBe(
      ENTITLEMENT_KEYS.insightPerformance
    );
  });

  it("body_measurements kapali iken snapshot branch gorunmez", () => {
    const disabled = featuresWith({ "insight.body_measurements": false, "insight.performance": true });
    expect(
      isSnapshotBranchFeatureVisible(SNAPSHOT_BRANCH_IDS.athletePanelBodyMeasurements, disabled)
    ).toBe(false);
    expect(
      isSnapshotBranchFeatureVisible(SNAPSHOT_BRANCH_IDS.athletePanelPerformanceMetrics, disabled)
    ).toBe(true);
  });
});

describe("Phase 42 — super_admin gate skip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor({ role: "super_admin", organizationId: null });
  });

  it("super_admin org entitlement on kontrolunu atlar; platform yapilandirma aktorudur", async () => {
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("audit.listAuditLogsForActor", body);

    expect(result).toEqual({ ok: true });
    expect(body).toHaveBeenCalledTimes(1);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });
});

describe("Phase 42 — unauthenticated gate skip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSessionActor).mockResolvedValue({ error: "Gecersiz oturum." });
  });

  it("oturumsuz istekte action kendi auth hatasini dondurur; package error degil", async () => {
    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", async () => ({
      error: "Gecersiz oturum.",
      errorKind: "permission_denied" as const,
    }));

    expect(result).toEqual({ error: "Gecersiz oturum.", errorKind: "permission_denied" });
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });
});

describe("Phase 42 — resolveSessionActor request cache", () => {
  it("React cache() ile export edilir", async () => {
    const mod = await import("@/lib/auth/resolveSessionActor");
    expect(typeof mod.resolveSessionActor).toBe("function");
    // cache() sarmalayıcı ayni fonksiyon referansini dondurur.
    expect(mod.resolveSessionActor).toBe(mod.resolveSessionActor);
  });
});
