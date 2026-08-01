import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrganizationBranding } from "../parser";
import { invalidateOrganizationBrandingProcessCache } from "../runtime/processCache";
import { validateBranding } from "../validation";
import { serializeBranding } from "./constants";
import type {
  GetOrganizationBrandingResult,
  OrganizationBrandingPersistencePort,
  OrganizationBrandingRepositoryErrorCode,
  OrganizationBrandingRuntimeRow,
  SaveOrganizationBrandingInput,
  SaveOrganizationBrandingResult,
} from "./types";

const BRANDING_RUNTIME_SELECT = "branding, branding_revision" as const;

function repositoryError(
  code: OrganizationBrandingRepositoryErrorCode,
  message: string
): SaveOrganizationBrandingResult {
  return { ok: false, code, message };
}

function buildRuntimeRow(
  branding: OrganizationBrandingRuntimeRow["branding"],
  brandingRevision: number,
  parseFallback?: boolean
): OrganizationBrandingRuntimeRow {
  return {
    branding: Object.freeze({
      ...branding,
      brandingRevision,
    }),
    brandingRevision,
    parseFallback,
  };
}

/**
 * Persistence read — yalnizca repository/runtime katmani cagirmali.
 */
export async function getOrganizationBranding(
  port: OrganizationBrandingPersistencePort,
  organizationId: string
): Promise<GetOrganizationBrandingResult> {
  const row = await port.readBrandingRuntime(organizationId);
  if (!row.ok) {
    return {
      ok: false,
      code: row.notFound ? "not_found" : "read_failed",
      message: row.message,
    };
  }

  const parsed = parseOrganizationBranding(row.branding);
  const data = buildRuntimeRow(parsed.branding, row.brandingRevision, !parsed.ok);

  return { ok: true, data };
}

/**
 * Tek write path — validate → normalize → revision check → branding_revision++ → write.
 * Bu fonksiyon disinda organizations.branding guncellenmemelidir.
 */
export async function saveOrganizationBranding(
  port: OrganizationBrandingPersistencePort,
  input: SaveOrganizationBrandingInput
): Promise<SaveOrganizationBrandingResult> {
  const parsed = parseOrganizationBranding(input.branding);
  if (!parsed.ok) {
    return repositoryError("invalid_input", `Branding parse basarisiz: ${parsed.reason}`);
  }

  const validation = validateBranding(parsed.branding);
  if (!validation.ok) {
    return repositoryError("invalid_input", validation.errors.join(" "));
  }

  const normalized = parsed.branding;

  const current = await port.readBrandingRuntime(input.organizationId);
  if (!current.ok) {
    return repositoryError(current.notFound ? "not_found" : "read_failed", current.message);
  }

  if (
    input.expectedRevision !== undefined &&
    current.brandingRevision !== input.expectedRevision
  ) {
    return repositoryError(
      "revision_conflict",
      `branding_revision beklenen ${input.expectedRevision}, mevcut ${current.brandingRevision}.`
    );
  }

  const nextRevision = current.brandingRevision + 1;
  const brandingForWrite = Object.freeze({
    ...normalized,
    brandingRevision: nextRevision,
  });
  const payload = serializeBranding(brandingForWrite);

  const write = await port.writeBranding({
    organizationId: input.organizationId,
    branding: payload,
    nextRevision,
    expectedRevision: input.expectedRevision,
  });

  if (!write.ok) {
    return repositoryError(
      write.revisionConflict ? "revision_conflict" : "write_failed",
      write.message
    );
  }

  invalidateOrganizationBrandingProcessCache(input.organizationId);

  return {
    ok: true,
    data: buildRuntimeRow(brandingForWrite, write.brandingRevision),
  };
}

export function createSupabaseOrganizationBrandingPersistencePort(
  adminClient: SupabaseClient
): OrganizationBrandingPersistencePort {
  return {
    async readBrandingRuntime(organizationId) {
      const { data, error } = await adminClient
        .from("organizations")
        .select(BRANDING_RUNTIME_SELECT)
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message };
      }
      if (!data) {
        return { ok: false, message: "Organizasyon bulunamadi.", notFound: true };
      }

      const row = data as { branding?: unknown; branding_revision?: number | null };
      return {
        ok: true,
        branding: row.branding ?? {},
        brandingRevision: typeof row.branding_revision === "number" ? row.branding_revision : 1,
      };
    },

    async writeBranding(input) {
      if (input.expectedRevision !== undefined) {
        const { data: current, error: readError } = await adminClient
          .from("organizations")
          .select("branding_revision")
          .eq("id", input.organizationId)
          .maybeSingle();

        if (readError) {
          return { ok: false, message: readError.message };
        }
        if (!current) {
          return { ok: false, message: "Organizasyon bulunamadi." };
        }
        const revision = (current as { branding_revision?: number | null }).branding_revision ?? 1;
        if (revision !== input.expectedRevision) {
          return {
            ok: false,
            message: `branding_revision beklenen ${input.expectedRevision}, mevcut ${revision}.`,
            revisionConflict: true,
          };
        }
      }

      const payload = {
        branding: input.branding,
        branding_revision: input.nextRevision,
      };

      const { data, error } = await adminClient
        .from("organizations")
        .update(payload)
        .eq("id", input.organizationId)
        .select(BRANDING_RUNTIME_SELECT)
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message };
      }
      if (!data) {
        return { ok: false, message: "Organizasyon guncellenemedi." };
      }

      const row = data as { branding_revision?: number | null };
      return {
        ok: true,
        brandingRevision: typeof row.branding_revision === "number" ? row.branding_revision : input.nextRevision,
      };
    },
  };
}

export async function getOrganizationBrandingFromAdminClient(
  adminClient: SupabaseClient,
  organizationId: string
): Promise<GetOrganizationBrandingResult> {
  return getOrganizationBranding(
    createSupabaseOrganizationBrandingPersistencePort(adminClient),
    organizationId
  );
}

export async function saveOrganizationBrandingFromAdminClient(
  adminClient: SupabaseClient,
  input: SaveOrganizationBrandingInput
): Promise<SaveOrganizationBrandingResult> {
  return saveOrganizationBranding(
    createSupabaseOrganizationBrandingPersistencePort(adminClient),
    input
  );
}
