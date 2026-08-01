import { emitOrganizationBrandingRuntimeMetric } from "./metrics";
import type { OrganizationBrandingRuntimeSnapshot } from "./types";

const DEFAULT_TTL_MS = 45_000;

type ProcessCacheEntry = OrganizationBrandingRuntimeSnapshot & {
  expiresAtMs: number;
};

const processCache = new Map<string, ProcessCacheEntry>();

export function getBrandingProcessCacheTtlMs(): number {
  const raw = process.env.PEAKER_ORG_BRANDING_CACHE_TTL_MS;
  if (!raw) {
    return DEFAULT_TTL_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return DEFAULT_TTL_MS;
  }
  return Math.min(parsed, 120_000);
}

export function readOrganizationBrandingProcessCache(
  organizationId: string
): OrganizationBrandingRuntimeSnapshot | null {
  const entry = processCache.get(organizationId);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAtMs) {
    processCache.delete(organizationId);
    emitOrganizationBrandingRuntimeMetric({ type: "branding_ttl_expiry" });
    return null;
  }
  return {
    branding: entry.branding,
    brandingRevision: entry.brandingRevision,
  };
}

export function writeOrganizationBrandingProcessCache(
  organizationId: string,
  snapshot: OrganizationBrandingRuntimeSnapshot
): void {
  processCache.set(organizationId, {
    ...snapshot,
    expiresAtMs: Date.now() + getBrandingProcessCacheTtlMs(),
  });
}

export function invalidateOrganizationBrandingProcessCache(organizationId: string): void {
  processCache.delete(organizationId);
}

export function clearOrganizationBrandingProcessCacheForTests(): void {
  processCache.clear();
}

export function getOrganizationBrandingProcessCacheSizeForTests(): number {
  return processCache.size;
}
