import type { OrganizationBranding } from "../types";

/** Runtime read — yalnizca organizations.branding + branding_revision. */
export type OrganizationBrandingRuntimeRow = {
  branding: OrganizationBranding;
  brandingRevision: number;
  /** Parser fail-closed veya normalize fallback kullanildi. */
  parseFallback?: boolean;
};

export type OrganizationBrandingRepositoryErrorCode =
  | "not_found"
  | "read_failed"
  | "write_failed"
  | "revision_conflict"
  | "invalid_input";

export type OrganizationBrandingRepositoryError = {
  ok: false;
  code: OrganizationBrandingRepositoryErrorCode;
  message: string;
};

export type GetOrganizationBrandingResult =
  | { ok: true; data: OrganizationBrandingRuntimeRow }
  | OrganizationBrandingRepositoryError;

export type SaveOrganizationBrandingInput = {
  organizationId: string;
  branding: unknown;
  /** Optimistic concurrency — verilirse eslesmezse revision_conflict. */
  expectedRevision?: number;
};

export type SaveOrganizationBrandingResult =
  | { ok: true; data: OrganizationBrandingRuntimeRow }
  | OrganizationBrandingRepositoryError;

/**
 * Repository test ve ileriki fazlar icin in-memory/Supabase adapter kontrati.
 * Supabase tipleri bu katmanin disinda kalir.
 */
export type OrganizationBrandingPersistencePort = {
  readBrandingRuntime(organizationId: string): Promise<
    | { ok: true; branding: unknown; brandingRevision: number }
    | { ok: false; message: string; notFound?: boolean }
  >;
  writeBranding(input: {
    organizationId: string;
    branding: Record<string, unknown>;
    nextRevision: number;
    expectedRevision?: number;
  }): Promise<
    | { ok: true; brandingRevision: number }
    | { ok: false; message: string; revisionConflict?: boolean }
  >;
};
