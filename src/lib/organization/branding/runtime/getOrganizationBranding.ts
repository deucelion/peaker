import { createDefaultBranding } from "../defaults";
import { getOrganizationBranding as readOrganizationBrandingPersistence } from "../persistence/organizationBrandingRepository";
import type { OrganizationBrandingPersistencePort } from "../persistence/types";
import { isOrganizationBrandingRuntimeEnabled } from "./killSwitch";
import { emitOrganizationBrandingRuntimeMetric } from "./metrics";
import {
  invalidateOrganizationBrandingProcessCache,
  readOrganizationBrandingProcessCache,
  writeOrganizationBrandingProcessCache,
} from "./processCache";
import {
  readOrganizationBrandingRequestCache,
  writeOrganizationBrandingRequestCache,
} from "./requestCache";
import type {
  GetOrganizationBrandingRuntimeOptions,
  OrganizationBrandingRuntimeResult,
  OrganizationBrandingRuntimeSnapshot,
} from "./types";

export const KILL_SWITCH_BRANDING_REVISION = 0 as const;

function createKillSwitchSnapshot(): OrganizationBrandingRuntimeSnapshot {
  return {
    branding: createDefaultBranding(),
    brandingRevision: KILL_SWITCH_BRANDING_REVISION,
  };
}

function createRepositoryFallbackSnapshot(): OrganizationBrandingRuntimeSnapshot {
  return createKillSwitchSnapshot();
}

function toRuntimeResult(
  snapshot: OrganizationBrandingRuntimeSnapshot,
  source: OrganizationBrandingRuntimeResult["source"]
): OrganizationBrandingRuntimeResult {
  return { ...snapshot, source };
}

async function resolvePersistencePort(
  options: GetOrganizationBrandingRuntimeOptions
): Promise<OrganizationBrandingPersistencePort> {
  if (options.persistencePort) {
    return options.persistencePort;
  }
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const { createSupabaseOrganizationBrandingPersistencePort } = await import(
    "../persistence/organizationBrandingRepository"
  );
  return createSupabaseOrganizationBrandingPersistencePort(createSupabaseAdminClient());
}

type PersistenceLoadResult =
  | { ok: true; snapshot: OrganizationBrandingRuntimeSnapshot; parseFallback: boolean }
  | { ok: false; snapshot: OrganizationBrandingRuntimeSnapshot };

async function loadSnapshotFromPersistence(
  organizationId: string,
  port: OrganizationBrandingPersistencePort
): Promise<PersistenceLoadResult> {
  const loaded = await readOrganizationBrandingPersistence(port, organizationId);
  if (!loaded.ok) {
    emitOrganizationBrandingRuntimeMetric({ type: "branding_repository_fallback" });
    return { ok: false, snapshot: createRepositoryFallbackSnapshot() };
  }

  const parseFallback = Boolean(loaded.data.parseFallback);
  if (parseFallback) {
    emitOrganizationBrandingRuntimeMetric({ type: "branding_parse_fallback" });
  }

  return {
    ok: true,
    parseFallback,
    snapshot: {
      branding: loaded.data.branding,
      brandingRevision: loaded.data.brandingRevision,
    },
  };
}

async function reconcileProcessCacheRevision(
  organizationId: string,
  port: OrganizationBrandingPersistencePort
): Promise<OrganizationBrandingRuntimeSnapshot | null> {
  const processCached = readOrganizationBrandingProcessCache(organizationId);
  if (!processCached) {
    return null;
  }

  const revisionRow = await port.readBrandingRuntime(organizationId);
  if (!revisionRow.ok) {
    return processCached;
  }

  if (revisionRow.brandingRevision === processCached.brandingRevision) {
    return processCached;
  }

  emitOrganizationBrandingRuntimeMetric({ type: "branding_revision_invalidate" });
  invalidateOrganizationBrandingProcessCache(organizationId);
  return null;
}

function cacheSnapshotEverywhere(organizationId: string, snapshot: OrganizationBrandingRuntimeSnapshot): void {
  writeOrganizationBrandingRequestCache(organizationId, snapshot);
  writeOrganizationBrandingProcessCache(organizationId, snapshot);
}

/**
 * Runtime tek giris noktasi — UI/layout/me-access ileride yalnizca bunu cagirir.
 * Repository disari import edilmemeli.
 */
export async function getOrganizationBranding(
  organizationId: string,
  options: GetOrganizationBrandingRuntimeOptions = {}
): Promise<OrganizationBrandingRuntimeResult> {
  if (!organizationId.trim()) {
    emitOrganizationBrandingRuntimeMetric({ type: "branding_repository_fallback" });
    return toRuntimeResult(createRepositoryFallbackSnapshot(), "repository_error_fallback");
  }

  if (!isOrganizationBrandingRuntimeEnabled()) {
    emitOrganizationBrandingRuntimeMetric({ type: "branding_kill_switch" });
    return toRuntimeResult(createKillSwitchSnapshot(), "kill_switch");
  }

  const requestCached = readOrganizationBrandingRequestCache(organizationId);
  if (requestCached) {
    emitOrganizationBrandingRuntimeMetric({ type: "branding_request_cache" });
    return toRuntimeResult(requestCached, "request_cache");
  }

  const port = await resolvePersistencePort(options);
  const processCached = await reconcileProcessCacheRevision(organizationId, port);
  if (processCached) {
    emitOrganizationBrandingRuntimeMetric({ type: "branding_process_cache" });
    writeOrganizationBrandingRequestCache(organizationId, processCached);
    return toRuntimeResult(processCached, "process_cache");
  }

  emitOrganizationBrandingRuntimeMetric({ type: "branding_cache_miss" });

  const loaded = await loadSnapshotFromPersistence(organizationId, port);
  if (!loaded.ok) {
    return toRuntimeResult(loaded.snapshot, "repository_error_fallback");
  }

  cacheSnapshotEverywhere(organizationId, loaded.snapshot);
  emitOrganizationBrandingRuntimeMetric({ type: "branding_database" });
  return toRuntimeResult(
    loaded.snapshot,
    loaded.parseFallback ? "parse_fallback" : "database"
  );
}

export { invalidateOrganizationBrandingProcessCache as invalidateOrganizationBrandingRuntimeCache };
