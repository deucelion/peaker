import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "../presets";
import type { OrganizationFeaturesPersistencePort } from "../persistence/types";
import { clearOrganizationFeaturesProcessCacheForTests } from "./processCache";
import { getOrganizationFeatures } from "./getOrganizationFeatures";
import { resetOrganizationFeaturesRuntimeMetricsForTests } from "./metrics";

function createPort(
  rows: Record<string, { features: unknown; featuresRevision: number }>,
  options?: { failRead?: boolean }
): OrganizationFeaturesPersistencePort {
  return {
    async readFeaturesRuntime(organizationId) {
      if (options?.failRead) return { ok: false, message: "db down" };
      const row = rows[organizationId];
      if (!row) return { ok: false, message: "missing", notFound: true };
      return { ok: true, features: row.features, featuresRevision: row.featuresRevision };
    },
    async readFeaturesRevision(organizationId) {
      if (options?.failRead) return { ok: false, message: "db down" };
      const row = rows[organizationId];
      if (!row) return { ok: false, message: "missing", notFound: true };
      return { ok: true, featuresRevision: row.featuresRevision };
    },
    async writeFeatureConfiguration() {
      return { ok: false, message: "not implemented" };
    },
  } as OrganizationFeaturesPersistencePort;
}

/**
 * FAZ 41 — fail-closed feature resolution.
 * Fail-closed yalnizca kill switch ON iken devrededir; OFF iken legacy davranis korunur.
 */
describe("FAZ 41 — fail-closed feature resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearOrganizationFeaturesProcessCacheForTests();
    resetOrganizationFeaturesRuntimeMetricsForTests();
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_FEATURES;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  describe("kill switch ON", () => {
    beforeEach(() => {
      vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    });

    it("10. repository success + configurable true → ALLOW", async () => {
      const port = createPort({
        "org-1": { features: { schemaVersion: 1, core: true, athlete: true, finance: true }, featuresRevision: 3 },
      });

      const result = await getOrganizationFeatures("org-1", { persistencePort: port });

      expect(result.source).toBe("database");
      expect(result.features.finance).toBe(true);
    });

    it("11. repository failure → DENY (configurable fail-closed)", async () => {
      const port = createPort({}, { failRead: true });

      const result = await getOrganizationFeatures("org-1", { persistencePort: port });

      expect(result.features.finance).toBe(false);
      expect(result.features.audit).toBe(false);
      expect(result.features["insight.performance"]).toBe(false);
    });

    it("12. malformed payload → DENY (parser fail-closed)", async () => {
      const port = createPort({
        "org-1": { features: "not-an-object", featuresRevision: 1 },
      });

      const result = await getOrganizationFeatures("org-1", { persistencePort: port });

      expect(result.features.finance).toBe(false);
      expect(result.features.core).toBe(true);
      expect(result.features.athlete).toBe(true);
    });

    it("13. blank organization → DENY without touching the repository", async () => {
      const readFeaturesRuntime = vi.fn();
      const port = { readFeaturesRuntime } as unknown as OrganizationFeaturesPersistencePort;

      const result = await getOrganizationFeatures("   ", { persistencePort: port });

      expect(result.source).toBe("repository_error_fallback");
      expect(result.features.finance).toBe(false);
      expect(readFeaturesRuntime).not.toHaveBeenCalled();
    });

    it("14. unknown organization → DENY", async () => {
      const port = createPort({
        "org-1": { features: createClubProfessionalFeatures(), featuresRevision: 1 },
      });

      const result = await getOrganizationFeatures("org-unknown", { persistencePort: port });

      expect(result.features.finance).toBe(false);
      expect(result.features["insight.field_tests"]).toBe(false);
    });

    it("15. configurable entitlement false → DENY", async () => {
      const port = createPort({
        "org-1": { features: { schemaVersion: 1, core: true, athlete: true, finance: false }, featuresRevision: 1 },
      });

      const result = await getOrganizationFeatures("org-1", { persistencePort: port });

      expect(result.features.finance).toBe(false);
    });

    it("16. always-on entitlements survive every fail-closed path", async () => {
      const failing = await getOrganizationFeatures("org-1", {
        persistencePort: createPort({}, { failRead: true }),
      });
      const blank = await getOrganizationFeatures("", {
        persistencePort: createPort({}),
      });

      for (const result of [failing, blank]) {
        expect(result.features.core).toBe(true);
        expect(result.features.athlete).toBe(true);
      }
    });
  });

  describe("kill switch OFF (current production state)", () => {
    it("keeps the legacy Club Professional fallback for a blank organization", async () => {
      const result = await getOrganizationFeatures("", {
        persistencePort: createPort({}),
      });

      expect(result.source).toBe("kill_switch");
      expect(result.features.finance).toBe(true);
    });

    it("keeps the legacy fallback even when the repository would fail", async () => {
      const result = await getOrganizationFeatures("org-1", {
        persistencePort: createPort({}, { failRead: true }),
      });

      expect(result.source).toBe("kill_switch");
      expect(result.features.finance).toBe(true);
    });
  });
});
