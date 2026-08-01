import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "../presets";
import type { OrganizationFeaturesPersistencePort } from "../persistence/types";
import {
  clearOrganizationFeaturesProcessCacheForTests,
  getProcessCacheTtlMs,
  readOrganizationFeaturesProcessCache,
  writeOrganizationFeaturesProcessCache,
} from "./processCache";
import {
  getOrganizationFeatures,
  invalidateOrganizationFeaturesRuntimeCache,
  KILL_SWITCH_FEATURES_REVISION,
} from "./getOrganizationFeatures";
import { isOrganizationFeaturesRuntimeEnabled } from "./killSwitch";
import {
  emitOrganizationFeaturesRuntimeMetric,
  resetOrganizationFeaturesRuntimeMetricsForTests,
  subscribeOrganizationFeaturesRuntimeMetrics,
} from "./metrics";
import { runWithOrganizationFeaturesRequestCacheAsync } from "./requestCache";

type MemoryRow = {
  features: unknown;
  featuresRevision: number;
  parseFallback?: boolean;
};

function createMockPort(
  rows: Record<string, MemoryRow>,
  options?: { failRead?: boolean }
): OrganizationFeaturesPersistencePort {
  let readCount = 0;
  return {
    async readFeaturesRuntime(organizationId) {
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
        features: row.features,
        featuresRevision: row.featuresRevision,
        parseFallback: row.parseFallback,
      };
    },
    async readFeaturesRevision(organizationId) {
      readCount += 1;
      if (options?.failRead) {
        return { ok: false, message: "db down" };
      }
      const row = rows[organizationId];
      if (!row) {
        return { ok: false, message: "missing", notFound: true };
      }
      return { ok: true, featuresRevision: row.featuresRevision };
    },
    async writeFeatureConfiguration() {
      return { ok: false, message: "not implemented" };
    },
    getReadCount: () => readCount,
  } as OrganizationFeaturesPersistencePort & { getReadCount: () => number };
}

describe("organization features runtime service", () => {
  const originalEnv = { ...process.env };
  const events: string[] = [];

  beforeEach(() => {
    clearOrganizationFeaturesProcessCacheForTests();
    resetOrganizationFeaturesRuntimeMetricsForTests();
    events.length = 0;
    subscribeOrganizationFeaturesRuntimeMetrics((event) => {
      events.push(event.type);
    });
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_FEATURES;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("kill switch OFF returns club professional fallback without DB read", async () => {
    const port = createMockPort({
      "org-1": { features: createClubProfessionalFeatures(), featuresRevision: 9 },
    });

    const result = await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(result.source).toBe("kill_switch");
    expect(result.featuresRevision).toBe(KILL_SWITCH_FEATURES_REVISION);
    expect(result.features.finance).toBe(true);
    expect(isOrganizationFeaturesRuntimeEnabled()).toBe(false);
    expect(events).toContain("kill_switch_fallback");
  });

  it("cache miss loads from persistence once and fills process cache", async () => {
    vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    const port = createMockPort({
      "org-1": {
        features: { schemaVersion: 1, core: true, athlete: true, finance: false },
        featuresRevision: 2,
      },
    }) as OrganizationFeaturesPersistencePort & { getReadCount: () => number };

    const first = await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(first.source).toBe("database");
    expect(first.features.finance).toBe(false);
    expect(events).toContain("cache_miss");

    const second = await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(second.source).toBe("process_cache");
    expect((port as OrganizationFeaturesPersistencePort & { getReadCount: () => number }).getReadCount()).toBe(2);
    expect(events.filter((e) => e === "cache_hit")).toHaveLength(1);
  });

  it("request cache prevents duplicate reads in same async context", async () => {
    vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    const port = createMockPort({
      "org-1": { features: createClubProfessionalFeatures(), featuresRevision: 1 },
    }) as OrganizationFeaturesPersistencePort & { getReadCount: () => number };

    await runWithOrganizationFeaturesRequestCacheAsync(async () => {
      const first = await getOrganizationFeatures("org-1", { persistencePort: port });
      const second = await getOrganizationFeatures("org-1", { persistencePort: port });
      expect(first.source).toBe("database");
      expect(second.source).toBe("request_cache");
    });

    expect((port as OrganizationFeaturesPersistencePort & { getReadCount: () => number }).getReadCount()).toBe(1);
  });

  it("expires process cache after TTL", async () => {
    vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    vi.stubEnv("PEAKER_ORG_FEATURES_CACHE_TTL_MS", "1000");
    vi.useFakeTimers();

    const port = createMockPort({
      "org-1": { features: createClubProfessionalFeatures(), featuresRevision: 1 },
    }) as OrganizationFeaturesPersistencePort & { getReadCount: () => number };

    await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(readOrganizationFeaturesProcessCache("org-1")).not.toBeNull();

    vi.advanceTimersByTime(getProcessCacheTtlMs() + 1);
    expect(readOrganizationFeaturesProcessCache("org-1")).toBeNull();
    expect(events).toContain("ttl_expiry");

    await getOrganizationFeatures("org-1", { persistencePort: port });
    expect((port as OrganizationFeaturesPersistencePort & { getReadCount: () => number }).getReadCount()).toBe(2);

    vi.useRealTimers();
  });

  it("invalidates process cache via helper after revision bump", async () => {
    writeOrganizationFeaturesProcessCache("org-1", {
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
    });
    invalidateOrganizationFeaturesRuntimeCache("org-1");
    expect(readOrganizationFeaturesProcessCache("org-1")).toBeNull();
  });

  it("invalidates stale process cache when features_revision changes", async () => {
    vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    writeOrganizationFeaturesProcessCache("org-1", {
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
    });

    const port = createMockPort({
      "org-1": {
        features: { schemaVersion: 1, core: true, athlete: true, finance: false },
        featuresRevision: 2,
      },
    }) as OrganizationFeaturesPersistencePort & { getReadCount: () => number };

    const result = await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(result.source).toBe("database");
    expect(result.featuresRevision).toBe(2);
    expect(result.features.finance).toBe(false);
    expect(events).toContain("revision_invalidate");
    expect(readOrganizationFeaturesProcessCache("org-1")?.featuresRevision).toBe(2);
  });

  it("falls back when repository read fails", async () => {
    vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    const port = createMockPort({}, { failRead: true });

    const result = await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(result.source).toBe("repository_error_fallback");
    expect(result.features.finance).toBe(true);
    expect(events).toContain("repository_error_fallback");
  });

  it("emits parse_fallback when persistence row used parser fail-closed", async () => {
    vi.stubEnv("PEAKER_ORG_FEATURES", "1");
    const port = createMockPort({
      "org-1": {
        features: null,
        featuresRevision: 1,
      },
    });

    const result = await getOrganizationFeatures("org-1", { persistencePort: port });
    expect(result.source).toBe("database");
    expect(result.features.finance).toBe(false);
    expect(events).toContain("parse_fallback");
  });
});

describe("runtime metrics hooks", () => {
  it("supports subscribe and reset without sending telemetry", () => {
    resetOrganizationFeaturesRuntimeMetricsForTests();
    const seen: string[] = [];
    const unsubscribe = subscribeOrganizationFeaturesRuntimeMetrics((event) => {
      seen.push(event.type);
    });
    emitOrganizationFeaturesRuntimeMetric({ type: "cache_miss" });
    unsubscribe();
    emitOrganizationFeaturesRuntimeMetric({ type: "cache_hit", layer: "process" });
    expect(seen).toEqual(["cache_miss"]);
  });
});
