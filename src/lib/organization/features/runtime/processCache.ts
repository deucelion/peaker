import { emitOrganizationFeaturesRuntimeMetric } from "./metrics";
import type { OrganizationFeaturesRuntimeSnapshot } from "./types";

const DEFAULT_TTL_MS = 45_000;

type ProcessCacheEntry = OrganizationFeaturesRuntimeSnapshot & {
  expiresAtMs: number;
};

const processCache = new Map<string, ProcessCacheEntry>();

export function getProcessCacheTtlMs(): number {
  const raw = process.env.PEAKER_ORG_FEATURES_CACHE_TTL_MS;
  if (!raw) {
    return DEFAULT_TTL_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return DEFAULT_TTL_MS;
  }
  return Math.min(parsed, 120_000);
}

export function readOrganizationFeaturesProcessCache(
  organizationId: string
): OrganizationFeaturesRuntimeSnapshot | null {
  const entry = processCache.get(organizationId);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAtMs) {
    processCache.delete(organizationId);
    emitOrganizationFeaturesRuntimeMetric({ type: "ttl_expiry" });
    return null;
  }
  return {
    features: entry.features,
    featuresRevision: entry.featuresRevision,
  };
}

export function writeOrganizationFeaturesProcessCache(
  organizationId: string,
  snapshot: OrganizationFeaturesRuntimeSnapshot
): void {
  processCache.set(organizationId, {
    ...snapshot,
    expiresAtMs: Date.now() + getProcessCacheTtlMs(),
  });
}

export function invalidateOrganizationFeaturesProcessCache(organizationId: string): void {
  processCache.delete(organizationId);
}

export function clearOrganizationFeaturesProcessCacheForTests(): void {
  processCache.clear();
}

export function getOrganizationFeaturesProcessCacheSizeForTests(): number {
  return processCache.size;
}
