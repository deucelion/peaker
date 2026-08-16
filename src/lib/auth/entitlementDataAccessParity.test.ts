import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS, ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import type { ConfigurableEntitlementKey, OrganizationFeatures } from "@/lib/organization/features/types";
import { resolveActionNamespaceEntitlementKey } from "@/lib/organization/features/surfaces/resolveActionNamespaceEntitlement";
import { resolveRouteEntitlementKey } from "@/lib/organization/features/surfaces/resolveRouteEntitlement";
import { PATHS } from "@/lib/navigation/routeRegistry";

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
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import {
  assertOrganizationEntitlement,
  isOrganizationEntitlementEnabled,
} from "@/lib/auth/serverActionFeatureAccess";
import { runServerActionWithFeatureGate } from "@/lib/auth/serverActionFeatureGate";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

/** Auto-gate yolu org id icin session actor'a bakar. */
function mockSessionOrganization(organizationId: string | null = ORG_ID) {
  vi.mocked(resolveSessionActor).mockResolvedValue({
    actor: { organizationId },
  } as never);
}

function featuresWith(overrides: Partial<Record<ConfigurableEntitlementKey, boolean>>): OrganizationFeatures {
  const configurable = Object.fromEntries(
    CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, overrides[key] ?? false])
  ) as Record<ConfigurableEntitlementKey, boolean>;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function mockFeatures(features: OrganizationFeatures) {
  vi.mocked(getOrganizationFeatures).mockResolvedValue({
    features,
    featuresRevision: 3,
    source: "database",
  });
}

describe("training report enforcement (P0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOrganization();
  });

  it("gates the /idman-raporu route on insight.training_reports", () => {
    expect(resolveRouteEntitlementKey(PATHS.idmanRaporu)).toBe(ENTITLEMENT_KEYS.insightTrainingReports);
  });

  it("gates the daily training load data action on the same entitlement as the route", () => {
    const routeKey = resolveRouteEntitlementKey(PATHS.idmanRaporu);
    const actionKey = resolveActionNamespaceEntitlementKey("trainingReport.listDailyTrainingLoadReports");

    expect(actionKey).toBe(ENTITLEMENT_KEYS.insightTrainingReports);
    expect(actionKey).toBe(routeKey);
  });

  it("no longer resolves the training load action to the always-on core entitlement", () => {
    expect(resolveActionNamespaceEntitlementKey("trainingReport.listDailyTrainingLoadReports")).not.toBe(
      ENTITLEMENT_KEYS.core
    );
  });

  it("allows the data action when training reports are enabled", async () => {
    mockFeatures(featuresWith({ "insight.training_reports": true }));

    const result = await runServerActionWithFeatureGate(
      "trainingReport.listDailyTrainingLoadReports",
      async () => ({ reports: [{ id: "load-1" }] })
    );

    expect(result).toEqual({ reports: [{ id: "load-1" }] });
  });

  it("denies the data action when training reports are disabled even though core stays on", async () => {
    const features = featuresWith({ "insight.training_reports": false });
    expect(features.core).toBe(true);
    mockFeatures(features);

    const result = await runServerActionWithFeatureGate(
      "trainingReport.listDailyTrainingLoadReports",
      async () => ({ reports: [{ id: "load-1" }] })
    );

    expect(result).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("denies the data action when only performance is enabled", async () => {
    mockFeatures(featuresWith({ "insight.performance": true, "insight.training_reports": false }));

    const denial = await assertOrganizationEntitlement(ENTITLEMENT_KEYS.insightTrainingReports, ORG_ID);

    expect(denial).not.toBeNull();
  });

  it("keeps the explicit pre-check from running the action body when denied", async () => {
    mockFeatures(featuresWith({ "insight.training_reports": false }));
    const body = vi.fn(async () => ({ reports: [] }));

    const result = await runServerActionWithFeatureGate(
      "trainingReport.listDailyTrainingLoadReports",
      async (ctx) => {
        const denial = await ctx.assertOrganizationFeature(ORG_ID);
        if (denial) return denial;
        return body();
      }
    );

    expect(body).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("runs the action body through the explicit pre-check when allowed", async () => {
    mockFeatures(featuresWith({ "insight.training_reports": true }));
    const body = vi.fn(async () => ({ reports: [{ id: "load-1" }] }));

    const result = await runServerActionWithFeatureGate(
      "trainingReport.listDailyTrainingLoadReports",
      async (ctx) => {
        const denial = await ctx.assertOrganizationFeature(ORG_ID);
        if (denial) return denial;
        return body();
      }
    );

    expect(body).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ reports: [{ id: "load-1" }] });
  });

  it("leaves the remaining managementDirectory actions on core", () => {
    expect(resolveActionNamespaceEntitlementKey("managementDirectory.listManagementDirectory")).toBe(
      ENTITLEMENT_KEYS.core
    );
  });
});

describe("per-entitlement data slice assertions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOrganization();
  });

  it("reports an entitlement as enabled when the organization has it", async () => {
    mockFeatures(createClubProfessionalFeatures());

    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightBodyMeasurements, ORG_ID)
    ).resolves.toBe(true);
  });

  it("reports an entitlement as disabled when the organization lacks it", async () => {
    mockFeatures(featuresWith({}));

    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightBodyMeasurements, ORG_ID)
    ).resolves.toBe(false);
  });

  it("never denies always-on entitlements", async () => {
    mockFeatures(featuresWith({}));

    await expect(isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.core, ORG_ID)).resolves.toBe(true);
    await expect(isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.athlete, ORG_ID)).resolves.toBe(true);
    await expect(assertOrganizationEntitlement(ENTITLEMENT_KEYS.core, ORG_ID)).resolves.toBeNull();
  });

  it("returns the shared denial payload shape used by the action gate", async () => {
    mockFeatures(featuresWith({}));

    await expect(
      assertOrganizationEntitlement(ENTITLEMENT_KEYS.insightFieldTests, ORG_ID)
    ).resolves.toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("resolves each insight slice independently", async () => {
    mockFeatures(
      featuresWith({
        "insight.field_tests": true,
        "insight.training_reports": false,
        "insight.wellness_archive": true,
        "insight.body_measurements": false,
      })
    );

    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightFieldTests, ORG_ID)
    ).resolves.toBe(true);
    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightTrainingReports, ORG_ID)
    ).resolves.toBe(false);
    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightWellnessArchive, ORG_ID)
    ).resolves.toBe(true);
    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightBodyMeasurements, ORG_ID)
    ).resolves.toBe(false);
  });
});

describe("body measurement enforcement (P0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOrganization();
  });

  it("gates the dedicated body measurement namespace on its own entitlement", () => {
    expect(resolveActionNamespaceEntitlementKey("bodyMeasurement.recordMyBodyMeasurement")).toBe(
      ENTITLEMENT_KEYS.insightBodyMeasurements
    );
  });

  it("denies body measurement actions when the entitlement is off", async () => {
    mockFeatures(featuresWith({ "insight.development_hub": true }));

    const result = await runServerActionWithFeatureGate(
      "bodyMeasurement.listMyBodyMeasurements",
      async () => ({ measurements: [{ id: "m-1" }] })
    );

    expect(result).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
  });

  it("allows body measurement actions when the entitlement is on", async () => {
    mockFeatures(featuresWith({ "insight.body_measurements": true }));

    const result = await runServerActionWithFeatureGate(
      "bodyMeasurement.listMyBodyMeasurements",
      async () => ({ measurements: [{ id: "m-1" }] })
    );

    expect(result).toEqual({ measurements: [{ id: "m-1" }] });
  });

  it("keeps the profile-update write path gated on body measurements, not the always-on athlete key", async () => {
    mockFeatures(featuresWith({ "insight.body_measurements": false }));

    // athleteSelfProfile resolves to the always-on `athlete` key, so the shared
    // sync helper must consult the measurement entitlement itself.
    expect(resolveActionNamespaceEntitlementKey("athleteSelfProfile.updateAthleteSelfProfile")).toBe(
      ENTITLEMENT_KEYS.athlete
    );
    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.athlete, ORG_ID)
    ).resolves.toBe(true);
    await expect(
      isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.insightBodyMeasurements, ORG_ID)
    ).resolves.toBe(false);
  });

  it("keeps the athlete detail aggregate on core while its slices carry insight keys", () => {
    expect(resolveActionNamespaceEntitlementKey("athleteDetail.loadAthleteDetailForManagement")).toBe(
      ENTITLEMENT_KEYS.core
    );
  });
});

describe("Phase 42 — finance/private_lessons aggregate slice gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOrganization();
  });

  it("finance slice bagimsiz olarak cozulur", async () => {
    mockFeatures(featuresWith({ finance: true, private_lessons: false }));

    await expect(isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.finance, ORG_ID)).resolves.toBe(true);
    await expect(isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.privateLessons, ORG_ID)).resolves.toBe(
      false
    );
  });

  it("private_lessons slice bagimsiz olarak cozulur", async () => {
    mockFeatures(featuresWith({ finance: false, private_lessons: true }));

    await expect(isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.finance, ORG_ID)).resolves.toBe(false);
    await expect(isOrganizationEntitlementEnabled(ENTITLEMENT_KEYS.privateLessons, ORG_ID)).resolves.toBe(
      true
    );
  });

  it("managementDirectory aggregate core namespace uzerinde kalir", () => {
    expect(resolveActionNamespaceEntitlementKey("managementDirectory.listManagementDirectory")).toBe(
      ENTITLEMENT_KEYS.core
    );
  });
});
