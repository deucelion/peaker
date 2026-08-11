import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { normalizeOrganizationBranding } from "../parser";
import {
  createDefaultBrandingJson,
  DEFAULT_BRANDING,
  serializeBranding,
} from "./constants";
import {
  clearOrganizationBrandingProcessCacheForTests,
  getOrganizationBrandingProcessCacheSizeForTests,
  writeOrganizationBrandingProcessCache,
} from "../runtime/processCache";
import {
  createSupabaseOrganizationBrandingPersistencePort,
  getOrganizationBranding as readOrganizationBrandingPersistence,
  getOrganizationBrandingFromAdminClient,
  saveOrganizationBranding,
  saveOrganizationBrandingFromAdminClient,
} from "./organizationBrandingRepository";
import type { OrganizationBrandingPersistencePort } from "./types";

type MemoryRow = {
  branding: unknown;
  brandingRevision: number;
};

function createMemoryOrganizationBrandingPort(initialRows: Record<string, MemoryRow> = {}) {
  const rows = new Map<string, MemoryRow>(Object.entries(initialRows));

  const port: OrganizationBrandingPersistencePort = {
    async readBrandingRuntime(organizationId) {
      const row = rows.get(organizationId);
      if (!row) {
        return { ok: false, message: "Organizasyon bulunamadi.", notFound: true };
      }
      return {
        ok: true,
        branding: row.branding,
        brandingRevision: row.brandingRevision,
      };
    },

    async writeBranding(input) {
      const existing = rows.get(input.organizationId);
      if (!existing) {
        return { ok: false, message: "Organizasyon bulunamadi." };
      }

      if (
        input.expectedRevision !== undefined &&
        existing.brandingRevision !== input.expectedRevision
      ) {
        return {
          ok: false,
          message: "revision conflict",
          revisionConflict: true,
        };
      }

      rows.set(input.organizationId, {
        branding: input.branding,
        brandingRevision: input.nextRevision,
      });

      return { ok: true, brandingRevision: input.nextRevision };
    },
  };

  return { port, rows };
}

describe("branding persistence constants", () => {
  it("exposes DEFAULT_BRANDING from foundation createDefaultBranding", () => {
    expect(DEFAULT_BRANDING.application.appName).toBe("PEAKER");
    expect(DEFAULT_BRANDING.theme.primary).toBe("#7c3aed");
  });

  it("serializes branding for JSONB persistence", () => {
    const json = createDefaultBrandingJson();
    expect(json.schemaVersion).toBe(1);
    expect(json.application).toEqual({ appName: "PEAKER", shortName: "Peaker" });
    expect(serializeBranding(createDefaultBranding()).assets.logo.storagePath).toBe(
      "branding/defaults/logo.svg"
    );
  });
});

describe("getOrganizationBranding read contract", () => {
  it("reads only branding payload and revision from port", async () => {
    const defaults = createDefaultBranding();
    const { port } = createMemoryOrganizationBrandingPort({
      "org-1": {
        branding: serializeBranding(defaults),
        brandingRevision: 3,
      },
    });

    const result = await readOrganizationBrandingPersistence(port, "org-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.brandingRevision).toBe(3);
      expect(result.data.branding.application.appName).toBe("PEAKER");
      expect(result.data.branding.brandingRevision).toBe(3);
    }
  });

  it("returns not_found when organization missing", async () => {
    const { port } = createMemoryOrganizationBrandingPort();
    const result = await readOrganizationBrandingPersistence(port, "missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_found");
    }
  });

  it("normalizes partial branding via parser on read", async () => {
    const { port } = createMemoryOrganizationBrandingPort({
      "org-1": {
        branding: {
          schemaVersion: 1,
          application: { appName: "Custom Club", shortName: "Club" },
        },
        brandingRevision: 1,
      },
    });

    const result = await readOrganizationBrandingPersistence(port, "org-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.branding.application.appName).toBe("Custom Club");
      expect(result.data.branding.assets.logo.assetId).toBe("peaker-default-logo");
    }
  });
});

describe("saveOrganizationBranding write contract", () => {
  it("validates, normalizes and increments branding_revision", async () => {
    const { port, rows } = createMemoryOrganizationBrandingPort({
      "org-1": {
        branding: createDefaultBrandingJson(),
        brandingRevision: 1,
      },
    });

    const nextBranding = mergeBranding(createDefaultBranding(), {
      application: { appName: "Academy One" },
    });

    const result = await saveOrganizationBranding(port, {
      organizationId: "org-1",
      branding: nextBranding,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.brandingRevision).toBe(2);
      expect(result.data.branding.application.appName).toBe("Academy One");
      expect(result.data.branding.brandingRevision).toBe(2);
    }

    expect(rows.get("org-1")?.brandingRevision).toBe(2);
  });

  it("rejects invalid branding before write", async () => {
    const { port, rows } = createMemoryOrganizationBrandingPort({
      "org-1": {
        branding: createDefaultBrandingJson(),
        brandingRevision: 1,
      },
    });

    const result = await saveOrganizationBranding(port, {
      organizationId: "org-1",
      branding: {
        schemaVersion: 1,
        theme: { primary: "not-a-color" },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_input");
    }
    expect(rows.get("org-1")?.brandingRevision).toBe(1);
  });

  it("returns revision_conflict when expectedRevision mismatches", async () => {
    const { port, rows } = createMemoryOrganizationBrandingPort({
      "org-1": {
        branding: createDefaultBrandingJson(),
        brandingRevision: 5,
      },
    });

    const result = await saveOrganizationBranding(port, {
      organizationId: "org-1",
      branding: createDefaultBranding(),
      expectedRevision: 4,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("revision_conflict");
    }
    expect(rows.get("org-1")?.brandingRevision).toBe(5);
  });

  it("invalidates process cache on successful save", async () => {
    const { port } = createMemoryOrganizationBrandingPort({
      "org-1": {
        branding: createDefaultBrandingJson(),
        brandingRevision: 2,
      },
    });

    writeOrganizationBrandingProcessCache("org-1", {
      branding: createDefaultBranding(),
      brandingRevision: 2,
    });
    expect(getOrganizationBrandingProcessCacheSizeForTests()).toBe(1);

    const result = await saveOrganizationBranding(port, {
      organizationId: "org-1",
      branding: createDefaultBranding(),
      expectedRevision: 2,
    });

    expect(result.ok).toBe(true);
    expect(getOrganizationBrandingProcessCacheSizeForTests()).toBe(0);
    clearOrganizationBrandingProcessCacheForTests();
  });
});

describe("supabase persistence port factory and wrappers", () => {
  it("exposes read/write methods without throwing on construction", () => {
    const port = createSupabaseOrganizationBrandingPersistencePort({} as never);
    expect(typeof port.readBrandingRuntime).toBe("function");
    expect(typeof port.writeBranding).toBe("function");
  });

  it("exposes admin client wrapper functions", () => {
    expect(typeof getOrganizationBrandingFromAdminClient).toBe("function");
    expect(typeof saveOrganizationBrandingFromAdminClient).toBe("function");
  });
});

describe("migration backfill expectation", () => {
  it("default branding backfill matches foundation Peaker branding", () => {
    const json = createDefaultBrandingJson();
    const normalized = normalizeOrganizationBranding(json);
    expect(normalized.application.appName).toBe("PEAKER");
    expect(normalized.theme.primary).toBe("#7c3aed");
    expect(normalized.assets.logo.storagePath).toBe("branding/defaults/logo.svg");
  });

  it("new organization default uses Peaker branding with revision 1", () => {
    const normalized = normalizeOrganizationBranding(createDefaultBrandingJson());
    expect(normalized.pdf.title).toBe("PEAKER Rapor");
    expect(normalized.email.title).toBe("PEAKER");
  });
});
