import { createClubProfessionalFeatures } from "../presets";
import { readOrganizationFeaturesPersistence } from "../persistence/organizationFeaturesRepository";
import type { OrganizationFeaturesPersistencePort } from "../persistence/types";
import { isOrganizationFeaturesRuntimeEnabled } from "./killSwitch";
import { emitOrganizationFeaturesRuntimeMetric } from "./metrics";
import {
  invalidateOrganizationFeaturesProcessCache,
  readOrganizationFeaturesProcessCache,
  writeOrganizationFeaturesProcessCache,
} from "./processCache";
import {
  readOrganizationFeaturesRequestCache,
  writeOrganizationFeaturesRequestCache,
} from "./requestCache";
import type {
  GetOrganizationFeaturesOptions,
  OrganizationFeaturesRuntimeResult,
  OrganizationFeaturesRuntimeSnapshot,
} from "./types";

export const KILL_SWITCH_FEATURES_REVISION = 0 as const;

function createKillSwitchSnapshot(): OrganizationFeaturesRuntimeSnapshot {
  return {
    features: createClubProfessionalFeatures(),
    featuresRevision: KILL_SWITCH_FEATURES_REVISION,
  };
}

function toRuntimeResult(
  snapshot: OrganizationFeaturesRuntimeSnapshot,
  source: OrganizationFeaturesRuntimeResult["source"]
): OrganizationFeaturesRuntimeResult {
  return { ...snapshot, source };
}

async function resolvePersistencePort(
  options: GetOrganizationFeaturesOptions
): Promise<OrganizationFeaturesPersistencePort> {
  if (options.persistencePort) {
    return options.persistencePort;
  }
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const { createSupabaseOrganizationFeaturesPersistencePort } = await import(
    "../persistence/organizationFeaturesRepository"
  );
  return createSupabaseOrganizationFeaturesPersistencePort(createSupabaseAdminClient());
}

type PersistenceLoadResult =
  | { ok: true; snapshot: OrganizationFeaturesRuntimeSnapshot }
  | { ok: false; snapshot: OrganizationFeaturesRuntimeSnapshot };

async function loadSnapshotFromPersistence(
  organizationId: string,
  port: OrganizationFeaturesPersistencePort
): Promise<PersistenceLoadResult> {
  const loaded = await readOrganizationFeaturesPersistence(port, organizationId);
  if (!loaded.ok) {
    emitOrganizationFeaturesRuntimeMetric({ type: "repository_error_fallback" });
    return { ok: false, snapshot: createKillSwitchSnapshot() };
  }

  if (loaded.data.parseFallback) {
    emitOrganizationFeaturesRuntimeMetric({ type: "parse_fallback" });
  }

  return {
    ok: true,
    snapshot: {
      features: loaded.data.features,
      featuresRevision: loaded.data.featuresRevision,
    },
  };
}

async function reconcileProcessCacheRevision(
  organizationId: string,
  port: OrganizationFeaturesPersistencePort
): Promise<OrganizationFeaturesRuntimeSnapshot | null> {
  const processCached = readOrganizationFeaturesProcessCache(organizationId);
  if (!processCached) {
    return null;
  }

  const revisionRow = await port.readFeaturesRevision(organizationId);
  if (!revisionRow.ok) {
    return processCached;
  }

  if (revisionRow.featuresRevision === processCached.featuresRevision) {
    return processCached;
  }

  emitOrganizationFeaturesRuntimeMetric({ type: "revision_invalidate" });
  invalidateOrganizationFeaturesProcessCache(organizationId);
  return null;
}

function cacheSnapshotEverywhere(organizationId: string, snapshot: OrganizationFeaturesRuntimeSnapshot): void {
  writeOrganizationFeaturesRequestCache(organizationId, snapshot);
  writeOrganizationFeaturesProcessCache(organizationId, snapshot);
}

/**
 * Runtime tek giris noktasi — proxy, layout, actions, snapshot ileride yalnizca bunu cagirir.
 * Repository disari import edilmemeli.
 */
export async function getOrganizationFeatures(
  organizationId: string,
  options: GetOrganizationFeaturesOptions = {}
): Promise<OrganizationFeaturesRuntimeResult> {
  if (!organizationId.trim()) {
    emitOrganizationFeaturesRuntimeMetric({ type: "repository_error_fallback" });
    return toRuntimeResult(createKillSwitchSnapshot(), "repository_error_fallback");
  }

  if (!isOrganizationFeaturesRuntimeEnabled()) {
    emitOrganizationFeaturesRuntimeMetric({ type: "kill_switch_fallback" });
    return toRuntimeResult(createKillSwitchSnapshot(), "kill_switch");
  }

  const requestCached = readOrganizationFeaturesRequestCache(organizationId);
  if (requestCached) {
    emitOrganizationFeaturesRuntimeMetric({ type: "cache_hit", layer: "request" });
    return toRuntimeResult(requestCached, "request_cache");
  }

  const port = await resolvePersistencePort(options);
  const processCached = await reconcileProcessCacheRevision(organizationId, port);
  if (processCached) {
    emitOrganizationFeaturesRuntimeMetric({ type: "cache_hit", layer: "process" });
    writeOrganizationFeaturesRequestCache(organizationId, processCached);
    return toRuntimeResult(processCached, "process_cache");
  }

  emitOrganizationFeaturesRuntimeMetric({ type: "cache_miss" });

  const loaded = await loadSnapshotFromPersistence(organizationId, port);
  if (!loaded.ok) {
    return toRuntimeResult(loaded.snapshot, "repository_error_fallback");
  }

  cacheSnapshotEverywhere(organizationId, loaded.snapshot);
  return toRuntimeResult(loaded.snapshot, "database");
}

export { invalidateOrganizationFeaturesProcessCache as invalidateOrganizationFeaturesRuntimeCache };
