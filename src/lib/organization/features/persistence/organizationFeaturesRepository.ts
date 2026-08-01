import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrganizationFeatures } from "../parser";
import { recomputeEffective } from "../recompute";
import { invalidateOrganizationFeaturesProcessCache } from "../runtime/processCache";
import { serializeOrganizationFeaturesForPersistence } from "./constants";
import type {
  GetOrganizationFeaturesResult,
  OrganizationFeaturesPersistencePort,
  OrganizationFeaturesRepositoryErrorCode,
  OrganizationFeaturesRuntimeRow,
  SaveOrganizationFeatureConfigurationInput,
  SaveOrganizationFeatureConfigurationResult,
} from "./types";

const FEATURES_RUNTIME_SELECT = "features, features_revision" as const;

const FEATURES_WRITE_SELECT = "features, features_revision, feature_preset, feature_overrides" as const;

function repositoryError(
  code: OrganizationFeaturesRepositoryErrorCode,
  message: string
): SaveOrganizationFeatureConfigurationResult {
  return { ok: false, code, message };
}

/**
 * Persistence read — yalnizca runtime katmani cagirmali.
 * Dis kod `getOrganizationFeatures()` (runtime) kullanmali.
 */
export async function readOrganizationFeaturesPersistence(
  port: OrganizationFeaturesPersistencePort,
  organizationId: string
): Promise<GetOrganizationFeaturesResult> {
  const row = await port.readFeaturesRuntime(organizationId);
  if (!row.ok) {
    return {
      ok: false,
      code: row.notFound ? "not_found" : "read_failed",
      message: row.message,
    };
  }

  const parsed = parseOrganizationFeatures(row.features);
  const data: OrganizationFeaturesRuntimeRow = {
    features: parsed.features,
    featuresRevision: row.featuresRevision,
    parseFallback: !parsed.ok,
  };

  return { ok: true, data };
}

/**
 * Tek write path — preset + override → recomputeEffective → DB → features_revision++.
 * Bu fonksiyon dışında feature kolonları güncellenmemelidir.
 */
export async function saveOrganizationFeatureConfiguration(
  port: OrganizationFeaturesPersistencePort,
  input: SaveOrganizationFeatureConfigurationInput
): Promise<SaveOrganizationFeatureConfigurationResult> {
  const recomputed = recomputeEffective({
    preset: input.preset,
    overrides: input.overrides ?? {},
  });

  if (!recomputed.ok) {
    return repositoryError("invalid_input", recomputed.errors.join(" "));
  }

  const current = await port.readFeaturesRuntime(input.organizationId);
  if (!current.ok) {
    return repositoryError(current.notFound ? "not_found" : "read_failed", current.message);
  }

  if (
    input.expectedRevision !== undefined &&
    current.featuresRevision !== input.expectedRevision
  ) {
    return repositoryError(
      "revision_conflict",
      `features_revision beklenen ${input.expectedRevision}, mevcut ${current.featuresRevision}.`
    );
  }

  const nextRevision = current.featuresRevision + 1;
  const write = await port.writeFeatureConfiguration({
    organizationId: input.organizationId,
    featurePreset: input.preset,
    featureOverrides: recomputed.overrides,
    features: recomputed.features,
    nextRevision,
    expectedRevision: input.expectedRevision,
  });

  if (!write.ok) {
    return repositoryError(
      write.revisionConflict ? "revision_conflict" : "write_failed",
      write.message
    );
  }

  invalidateOrganizationFeaturesProcessCache(input.organizationId);

  return {
    ok: true,
    data: {
      features: recomputed.features,
      featuresRevision: write.featuresRevision,
      featurePreset: input.preset,
      featureOverrides: recomputed.overrides,
    },
  };
}

export function createSupabaseOrganizationFeaturesPersistencePort(
  adminClient: SupabaseClient
): OrganizationFeaturesPersistencePort {
  return {
    async readFeaturesRuntime(organizationId) {
      const { data, error } = await adminClient
        .from("organizations")
        .select(FEATURES_RUNTIME_SELECT)
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message };
      }
      if (!data) {
        return { ok: false, message: "Organizasyon bulunamadi.", notFound: true };
      }

      const row = data as { features?: unknown; features_revision?: number | null };
      return {
        ok: true,
        features: row.features ?? {},
        featuresRevision: typeof row.features_revision === "number" ? row.features_revision : 1,
      };
    },

    async readFeaturesRevision(organizationId) {
      const { data, error } = await adminClient
        .from("organizations")
        .select("features_revision")
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message };
      }
      if (!data) {
        return { ok: false, message: "Organizasyon bulunamadi.", notFound: true };
      }

      const row = data as { features_revision?: number | null };
      return {
        ok: true,
        featuresRevision: typeof row.features_revision === "number" ? row.features_revision : 1,
      };
    },

    async writeFeatureConfiguration(input) {
      if (input.expectedRevision !== undefined) {
        const { data: current, error: readError } = await adminClient
          .from("organizations")
          .select("features_revision")
          .eq("id", input.organizationId)
          .maybeSingle();

        if (readError) {
          return { ok: false, message: readError.message };
        }
        if (!current) {
          return { ok: false, message: "Organizasyon bulunamadi." };
        }
        const revision = (current as { features_revision?: number | null }).features_revision ?? 1;
        if (revision !== input.expectedRevision) {
          return {
            ok: false,
            message: `features_revision beklenen ${input.expectedRevision}, mevcut ${revision}.`,
            revisionConflict: true,
          };
        }
      }

      const payload = {
        feature_preset: input.featurePreset,
        feature_overrides: input.featureOverrides,
        features: serializeOrganizationFeaturesForPersistence(input.features),
        features_revision: input.nextRevision,
      };

      const { data, error } = await adminClient
        .from("organizations")
        .update(payload)
        .eq("id", input.organizationId)
        .select(FEATURES_WRITE_SELECT)
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message };
      }
      if (!data) {
        return { ok: false, message: "Organizasyon guncellenemedi." };
      }

      const row = data as { features_revision?: number | null };
      return {
        ok: true,
        featuresRevision: typeof row.features_revision === "number" ? row.features_revision : input.nextRevision,
      };
    },
  };
}

export async function getOrganizationFeaturesFromAdminClient(
  adminClient: SupabaseClient,
  organizationId: string
): Promise<GetOrganizationFeaturesResult> {
  return readOrganizationFeaturesPersistence(
    createSupabaseOrganizationFeaturesPersistencePort(adminClient),
    organizationId
  );
}

export async function saveOrganizationFeatureConfigurationFromAdminClient(
  adminClient: SupabaseClient,
  input: SaveOrganizationFeatureConfigurationInput
): Promise<SaveOrganizationFeatureConfigurationResult> {
  return saveOrganizationFeatureConfiguration(
    createSupabaseOrganizationFeaturesPersistencePort(adminClient),
    input
  );
}
