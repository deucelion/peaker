import { describe, expect, it } from "vitest";
import { createClubProfessionalFeatures } from "../presets";
import {
  clearOrganizationFeaturesProcessCacheForTests,
  readOrganizationFeaturesProcessCache,
  writeOrganizationFeaturesProcessCache,
} from "../runtime/processCache";
import { createClubProfessionalFeaturesJson, DEFAULT_ORGANIZATION_FEATURE_PRESET } from "./constants";
import {
  createSupabaseOrganizationFeaturesPersistencePort,
  readOrganizationFeaturesPersistence,
  saveOrganizationFeatureConfiguration,
} from "./organizationFeaturesRepository";
import type { OrganizationFeaturesPersistencePort } from "./types";

type MemoryRow = {
  featurePreset: string;
  featureOverrides: Record<string, boolean>;
  features: unknown;
  featuresRevision: number;
};

function createMemoryOrganizationFeaturesPort(initialRows: Record<string, MemoryRow> = {}) {
  const rows = new Map<string, MemoryRow>(Object.entries(initialRows));

  const port: OrganizationFeaturesPersistencePort = {
    async readFeaturesRuntime(organizationId) {
      const row = rows.get(organizationId);
      if (!row) {
        return { ok: false, message: "Organizasyon bulunamadi.", notFound: true };
      }
      return {
        ok: true,
        features: row.features,
        featuresRevision: row.featuresRevision,
      };
    },

    async readFeaturesRevision(organizationId) {
      const row = rows.get(organizationId);
      if (!row) {
        return { ok: false, message: "Organizasyon bulunamadi.", notFound: true };
      }
      return { ok: true, featuresRevision: row.featuresRevision };
    },

    async writeFeatureConfiguration(input) {
      const existing = rows.get(input.organizationId);
      if (!existing) {
        return { ok: false, message: "Organizasyon bulunamadi." };
      }

      if (
        input.expectedRevision !== undefined &&
        existing.featuresRevision !== input.expectedRevision
      ) {
        return {
          ok: false,
          message: "revision conflict",
          revisionConflict: true,
        };
      }

      rows.set(input.organizationId, {
        featurePreset: input.featurePreset,
        featureOverrides: { ...input.featureOverrides },
        features: input.features,
        featuresRevision: input.nextRevision,
      });

      return { ok: true, featuresRevision: input.nextRevision };
    },
  };

  return { port, rows };
}

describe("organization features persistence constants", () => {
  it("defaults to club professional preset id", () => {
    expect(DEFAULT_ORGANIZATION_FEATURE_PRESET).toBe("club_professional");
  });

  it("matches foundation createClubProfessionalFeatures json", () => {
    expect(createClubProfessionalFeaturesJson()).toEqual(createClubProfessionalFeatures());
  });
});

describe("readOrganizationFeaturesPersistence read contract", () => {
  it("reads only features payload and revision from port", async () => {
    const professional = createClubProfessionalFeatures();
    const { port } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "club_professional",
        featureOverrides: {},
        features: professional,
        featuresRevision: 3,
      },
    });

    const result = await readOrganizationFeaturesPersistence(port, "org-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.featuresRevision).toBe(3);
      expect(result.data.features.finance).toBe(true);
      expect(result.data.features.private_lessons).toBe(true);
    }
  });

  it("returns not_found when organization missing", async () => {
    const { port } = createMemoryOrganizationFeaturesPort();
    const result = await readOrganizationFeaturesPersistence(port, "missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_found");
    }
  });

  it("normalizes legacy partial features via parser", async () => {
    const { port } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "club_professional",
        featureOverrides: {},
        features: { schemaVersion: 1, core: true, athlete: true, finance: false },
        featuresRevision: 1,
      },
    });

    const result = await readOrganizationFeaturesPersistence(port, "org-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.features.finance).toBe(false);
      expect(result.data.features.audit).toBe(true);
    }
  });
});

describe("saveOrganizationFeatureConfiguration write contract", () => {
  it("recomputes preset + override and increments revision", async () => {
    const { port, rows } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "club_professional",
        featureOverrides: {},
        features: createClubProfessionalFeatures(),
        featuresRevision: 1,
      },
    });

    const result = await saveOrganizationFeatureConfiguration(port, {
      organizationId: "org-1",
      preset: "academy_lite",
      overrides: { finance: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.featuresRevision).toBe(2);
      expect(result.data.features.finance).toBe(true);
      expect(result.data.features.private_lessons).toBe(false);
      expect(result.data.featurePreset).toBe("academy_lite");
      expect(result.data.featureOverrides.finance).toBe(true);
    }

    const stored = rows.get("org-1");
    expect(stored?.featuresRevision).toBe(2);
    expect(stored?.featurePreset).toBe("academy_lite");
  });

  it("rejects invalid override keys before write", async () => {
    const { port, rows } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "club_professional",
        featureOverrides: {},
        features: createClubProfessionalFeatures(),
        featuresRevision: 1,
      },
    });

    const result = await saveOrganizationFeatureConfiguration(port, {
      organizationId: "org-1",
      preset: "academy_lite",
      overrides: { not_a_key: true } as never,
    });

    expect(result.ok).toBe(false);
    expect(rows.get("org-1")?.featuresRevision).toBe(1);
  });

  it("returns revision_conflict when expectedRevision mismatches", async () => {
    const { port, rows } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "club_professional",
        featureOverrides: {},
        features: createClubProfessionalFeatures(),
        featuresRevision: 5,
      },
    });

    const result = await saveOrganizationFeatureConfiguration(port, {
      organizationId: "org-1",
      preset: "academy_lite",
      expectedRevision: 4,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("revision_conflict");
    }
    expect(rows.get("org-1")?.featuresRevision).toBe(5);
  });

  it("expands insight bundle override on save", async () => {
    const { port } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "academy_lite",
        featureOverrides: {},
        features: createClubProfessionalFeatures(),
        featuresRevision: 1,
      },
    });

    const result = await saveOrganizationFeatureConfiguration(port, {
      organizationId: "org-1",
      preset: "academy_lite",
      overrides: { insight: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.features["insight.performance"]).toBe(true);
      expect(result.data.features["insight.field_tests"]).toBe(true);
    }
  });

  it("invalidates process cache after successful save", async () => {
    const { port, rows } = createMemoryOrganizationFeaturesPort({
      "org-1": {
        featurePreset: "club_professional",
        featureOverrides: {},
        features: createClubProfessionalFeatures(),
        featuresRevision: 1,
      },
    });

    clearOrganizationFeaturesProcessCacheForTests();
    writeOrganizationFeaturesProcessCache("org-1", {
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
    });

    await saveOrganizationFeatureConfiguration(port, {
      organizationId: "org-1",
      preset: "academy_lite",
    });

    expect(readOrganizationFeaturesProcessCache("org-1")).toBeNull();
    expect(rows.get("org-1")?.featuresRevision).toBe(2);
  });
});

describe("supabase persistence port factory", () => {
  it("exposes read/write methods without throwing on construction", () => {
    const port = createSupabaseOrganizationFeaturesPersistencePort({} as never);
    expect(typeof port.readFeaturesRuntime).toBe("function");
    expect(typeof port.writeFeatureConfiguration).toBe("function");
  });
});

describe("migration backfill expectation", () => {
  it("club professional backfill enables all configurable entitlements", () => {
    const features = createClubProfessionalFeatures();
    expect(features.core).toBe(true);
    expect(features.athlete).toBe(true);
    expect(Object.entries(features).every(([key, value]) => key === "schemaVersion" || value === true)).toBe(true);
  });
});
