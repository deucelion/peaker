import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { createDefaultBrandingJson } from "../persistence/constants";
import type { OrganizationBrandingPersistencePort } from "../persistence/types";
import { saveOrganizationBranding } from "../persistence/organizationBrandingRepository";
import {
  getOrganizationBranding,
  invalidateOrganizationBrandingRuntimeCache,
  KILL_SWITCH_BRANDING_REVISION,
} from "./getOrganizationBranding";
import { isOrganizationBrandingRuntimeEnabled } from "./killSwitch";
import {
  emitOrganizationBrandingRuntimeMetric,
  resetOrganizationBrandingRuntimeMetricsForTests,
  subscribeOrganizationBrandingRuntimeMetrics,
} from "./metrics";
import {
  clearOrganizationBrandingProcessCacheForTests,
  getBrandingProcessCacheTtlMs,
  readOrganizationBrandingProcessCache,
  writeOrganizationBrandingProcessCache,
} from "./processCache";
import { runWithOrganizationBrandingRequestCacheAsync } from "./requestCache";

type MemoryRow = {
  branding: unknown;
  brandingRevision: number;
  parseFallback?: boolean;
};

function createMockPort(
  rows: Record<string, MemoryRow>,
  options?: { failRead?: boolean }
): OrganizationBrandingPersistencePort {
  let readCount = 0;
  return {
    async readBrandingRuntime(organizationId) {
      readCount += 1;
      if (options?.failRead) {
        return { ok: false, message: "db down" };
      }
      const row = rows[organizationId];
      if (!row) {
        return { ok: false, message: "missing", notFound: true };
      }
      return {
        ok: true,
        branding: row.branding,
        brandingRevision: row.brandingRevision,
      };
    },
    async writeBranding() {
      return { ok: false, message: "not implemented" };
    },
    getReadCount: () => readCount,
  } as OrganizationBrandingPersistencePort & { getReadCount: () => number };
}

describe("organization branding runtime service", () => {
  const originalEnv = { ...process.env };
  const events: string[] = [];

  beforeEach(() => {
    clearOrganizationBrandingProcessCacheForTests();
    resetOrganizationBrandingRuntimeMetricsForTests();
    events.length = 0;
    subscribeOrganizationBrandingRuntimeMetrics((event) => {
      events.push(event.type);
    });
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_BRANDING;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("kill switch OFF returns default branding without DB read", async () => {
    const port = createMockPort({
      "org-1": { branding: createDefaultBrandingJson(), brandingRevision: 9 },
    });

    const result = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(result.source).toBe("kill_switch");
    expect(result.brandingRevision).toBe(KILL_SWITCH_BRANDING_REVISION);
    expect(result.branding.application.appName).toBe("PEAKER");
    expect(isOrganizationBrandingRuntimeEnabled()).toBe(false);
    expect(events).toContain("branding_kill_switch");
  });

  it("cache miss loads from persistence once and fills process cache", async () => {
    vi.stubEnv("PEAKER_ORG_BRANDING", "1");
    const port = createMockPort({
      "org-1": {
        branding: mergeBranding(createDefaultBranding(), {
          application: { appName: "Custom Club" },
        }),
        brandingRevision: 2,
      },
    }) as OrganizationBrandingPersistencePort & { getReadCount: () => number };

    const first = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(first.source).toBe("database");
    expect(first.branding.application.appName).toBe("Custom Club");
    expect(events).toContain("branding_cache_miss");
    expect(events).toContain("branding_database");

    const second = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(second.source).toBe("process_cache");
    expect((port as OrganizationBrandingPersistencePort & { getReadCount: () => number }).getReadCount()).toBe(2);
    expect(events).toContain("branding_process_cache");
  });

  it("request cache prevents duplicate reads in same async context", async () => {
    vi.stubEnv("PEAKER_ORG_BRANDING", "1");
    const port = createMockPort({
      "org-1": { branding: createDefaultBrandingJson(), brandingRevision: 1 },
    }) as OrganizationBrandingPersistencePort & { getReadCount: () => number };

    await runWithOrganizationBrandingRequestCacheAsync(async () => {
      const first = await getOrganizationBranding("org-1", { persistencePort: port });
      const second = await getOrganizationBranding("org-1", { persistencePort: port });
      expect(first.source).toBe("database");
      expect(second.source).toBe("request_cache");
    });

    expect((port as OrganizationBrandingPersistencePort & { getReadCount: () => number }).getReadCount()).toBe(1);
    expect(events).toContain("branding_request_cache");
  });

  it("expires process cache after TTL", async () => {
    vi.stubEnv("PEAKER_ORG_BRANDING", "1");
    vi.stubEnv("PEAKER_ORG_BRANDING_CACHE_TTL_MS", "1000");
    vi.useFakeTimers();

    const port = createMockPort({
      "org-1": { branding: createDefaultBrandingJson(), brandingRevision: 1 },
    }) as OrganizationBrandingPersistencePort & { getReadCount: () => number };

    await getOrganizationBranding("org-1", { persistencePort: port });
    expect(readOrganizationBrandingProcessCache("org-1")).not.toBeNull();

    vi.advanceTimersByTime(getBrandingProcessCacheTtlMs() + 1);
    expect(readOrganizationBrandingProcessCache("org-1")).toBeNull();
    expect(events).toContain("branding_ttl_expiry");

    await getOrganizationBranding("org-1", { persistencePort: port });
    expect((port as OrganizationBrandingPersistencePort & { getReadCount: () => number }).getReadCount()).toBe(2);

    vi.useRealTimers();
  });

  it("invalidates process cache via helper after save", async () => {
    writeOrganizationBrandingProcessCache("org-1", {
      branding: createDefaultBranding(),
      brandingRevision: 1,
    });
    invalidateOrganizationBrandingRuntimeCache("org-1");
    expect(readOrganizationBrandingProcessCache("org-1")).toBeNull();
  });

  it("invalidates stale process cache when branding_revision changes", async () => {
    vi.stubEnv("PEAKER_ORG_BRANDING", "1");
    writeOrganizationBrandingProcessCache("org-1", {
      branding: createDefaultBranding(),
      brandingRevision: 1,
    });

    const port = createMockPort({
      "org-1": {
        branding: mergeBranding(createDefaultBranding(), {
          application: { appName: "Updated Club" },
        }),
        brandingRevision: 2,
      },
    }) as OrganizationBrandingPersistencePort & { getReadCount: () => number };

    const result = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(result.source).toBe("database");
    expect(result.brandingRevision).toBe(2);
    expect(result.branding.application.appName).toBe("Updated Club");
    expect(events).toContain("branding_revision_invalidate");
    expect(readOrganizationBrandingProcessCache("org-1")?.brandingRevision).toBe(2);
  });

  it("falls back when repository read fails without caching", async () => {
    vi.stubEnv("PEAKER_ORG_BRANDING", "1");
    const port = createMockPort({}, { failRead: true });

    const first = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(first.source).toBe("repository_error_fallback");
    expect(first.brandingRevision).toBe(KILL_SWITCH_BRANDING_REVISION);
    expect(events).toContain("branding_repository_fallback");
    expect(readOrganizationBrandingProcessCache("org-1")).toBeNull();

    const second = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(second.source).toBe("repository_error_fallback");
  });

  it("returns parse_fallback source when persistence row used parser fail-closed", async () => {
    vi.stubEnv("PEAKER_ORG_BRANDING", "1");
    const port = createMockPort({
      "org-1": {
        branding: { schemaVersion: 99 },
        brandingRevision: 1,
      },
    });

    const result = await getOrganizationBranding("org-1", { persistencePort: port });
    expect(result.source).toBe("parse_fallback");
    expect(events).toContain("branding_parse_fallback");
  });

  it("save invalidates process cache after successful write", async () => {
    writeOrganizationBrandingProcessCache("org-1", {
      branding: createDefaultBranding(),
      brandingRevision: 1,
    });

    const port: OrganizationBrandingPersistencePort = {
      async readBrandingRuntime(organizationId) {
        return {
          ok: true,
          branding: createDefaultBrandingJson(),
          brandingRevision: 1,
        };
      },
      async writeBranding() {
        return { ok: true, brandingRevision: 2 };
      },
    };

    const result = await saveOrganizationBranding(port, {
      organizationId: "org-1",
      branding: mergeBranding(createDefaultBranding(), {
        application: { appName: "Saved Club" },
      }),
    });

    expect(result.ok).toBe(true);
    expect(readOrganizationBrandingProcessCache("org-1")).toBeNull();
  });
});

describe("branding runtime metrics hooks", () => {
  it("supports subscribe and reset without sending telemetry", () => {
    resetOrganizationBrandingRuntimeMetricsForTests();
    const seen: string[] = [];
    const unsubscribe = subscribeOrganizationBrandingRuntimeMetrics((event) => {
      seen.push(event.type);
    });
    emitOrganizationBrandingRuntimeMetric({ type: "branding_cache_miss" });
    unsubscribe();
    emitOrganizationBrandingRuntimeMetric({ type: "branding_process_cache" });
    expect(seen).toEqual(["branding_cache_miss"]);
  });
});

describe("branding process cache TTL config", () => {
  it("caps TTL override at 120 seconds", () => {
    vi.stubEnv("PEAKER_ORG_BRANDING_CACHE_TTL_MS", "999999");
    expect(getBrandingProcessCacheTtlMs()).toBe(120_000);
  });
});
