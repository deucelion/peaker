"use server";

import { revalidatePath } from "next/cache";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { captureServerActionError, withServerActionGuard } from "@/lib/observability/serverActionError";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import {
  buildSidebarFromTheme,
  validateThemeEditorInput,
} from "@/lib/organization/branding/editorValidation";
import {
  getOrganizationBrandingFromAdminClient,
  saveOrganizationBrandingFromAdminClient,
} from "@/lib/organization/branding/persistence/organizationBrandingRepository";
import type { BrandingTheme, OrganizationBranding } from "@/lib/organization/branding/types";
import { createSupabaseAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export type OrganizationBrandingEditorSnapshot = {
  organizationId: string;
  organizationName: string;
  branding: OrganizationBranding;
  brandingRevision: number;
};

export type SaveOrganizationBrandingActionInput = {
  organizationId: string;
  expectedRevision: number;
  theme: Partial<Record<keyof BrandingTheme, string>>;
};

export type OrganizationBrandingActionErrorKind =
  | "permission"
  | "validation"
  | "revision_conflict"
  | "not_found"
  | "unexpected";

export type SaveOrganizationBrandingActionResult =
  | { ok: true; brandingRevision: number }
  | {
      ok: false;
      error: string;
      errorKind: OrganizationBrandingActionErrorKind;
      fieldErrors?: Partial<Record<keyof BrandingTheme, string>>;
    };

export type LoadOrganizationBrandingActionResult =
  | { ok: true; snapshot: OrganizationBrandingEditorSnapshot }
  | { ok: false; error: string; errorKind: OrganizationBrandingActionErrorKind };

async function assertSuperAdminActor(): Promise<
  | { error: string }
  | { actor: { id: string; role: "super_admin" } }
> {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let actor =
    (await sessionClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle()).data ??
    null;

  if (!actor) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", authData.user.id)
        .maybeSingle();
      actor = data ?? null;
    } catch {
      // guard below decides
    }
  }

  const profileRole = getSafeRole(actor?.role);
  if (!actor || profileRole !== "super_admin") {
    return { error: "Bu islem sadece super admin icindir." as const };
  }

  return {
    actor: {
      id: actor.id,
      role: "super_admin" as const,
    },
  };
}

export async function loadOrganizationBrandingEditorSnapshot(
  organizationId: string
): Promise<LoadOrganizationBrandingActionResult> {
  return withServerActionGuard("organizationBranding.loadEditorSnapshot", async () => {
    const guard = await assertSuperAdminActor();
    if ("error" in guard) {
      return { ok: false as const, error: guard.error, errorKind: "permission" as const };
    }

    if (!isUuid(organizationId)) {
      return { ok: false as const, error: "Gecersiz organizasyon kimligi.", errorKind: "validation" as const };
    }

    const adminClient = createSupabaseAdminClient();
    const orgRes = await adminClient.from("organizations").select("name").eq("id", organizationId).maybeSingle();
    if (orgRes.error) {
      return { ok: false as const, error: orgRes.error.message, errorKind: "unexpected" as const };
    }
    if (!orgRes.data) {
      return { ok: false as const, error: "Organizasyon bulunamadi.", errorKind: "not_found" as const };
    }

    const brandingRes = await getOrganizationBrandingFromAdminClient(adminClient, organizationId);
    if (!brandingRes.ok) {
      return {
        ok: false as const,
        error: brandingRes.message,
        errorKind: (brandingRes.code === "not_found" ? "not_found" : "unexpected") as OrganizationBrandingActionErrorKind,
      };
    }

    return {
      ok: true as const,
      snapshot: {
        organizationId,
        organizationName: orgRes.data.name || `ORG-${organizationId.slice(0, 8).toUpperCase()}`,
        branding: brandingRes.data.branding,
        brandingRevision: brandingRes.data.brandingRevision,
      },
    };
  }).catch((error) => {
    captureServerActionError("organizationBranding.loadEditorSnapshot", error);
    return { ok: false, error: "Branding verisi yuklenemedi.", errorKind: "unexpected" as const };
  });
}

export async function saveOrganizationBrandingAction(
  input: SaveOrganizationBrandingActionInput
): Promise<SaveOrganizationBrandingActionResult> {
  return withServerActionGuard("organizationBranding.save", async () => {
    const guard = await assertSuperAdminActor();
    if ("error" in guard) {
      return { ok: false as const, error: guard.error, errorKind: "permission" as const };
    }

    if (!isUuid(input.organizationId)) {
      return { ok: false as const, error: "Gecersiz organizasyon kimligi.", errorKind: "validation" as const };
    }

    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
      return {
        ok: false as const,
        error: "Gecersiz branding revision.",
        errorKind: "validation" as const,
      };
    }

    const adminClient = createSupabaseAdminClient();
    const currentRes = await getOrganizationBrandingFromAdminClient(adminClient, input.organizationId);
    if (!currentRes.ok) {
      return {
        ok: false as const,
        error: currentRes.message,
        errorKind: (currentRes.code === "not_found" ? "not_found" : "unexpected") as OrganizationBrandingActionErrorKind,
      };
    }

    const merged = mergeBranding(currentRes.data.branding, {
      theme: input.theme,
      sidebar: buildSidebarFromTheme({
        ...currentRes.data.branding.theme,
        ...input.theme,
      } as BrandingTheme),
    });

    const validationFailure = validateThemeEditorInput(merged.theme);
    if (!validationFailure.ok) {
      return {
        ok: false as const,
        error: validationFailure.error,
        errorKind: "validation" as const,
        fieldErrors: validationFailure.fieldErrors,
      };
    }

    const saveRes = await saveOrganizationBrandingFromAdminClient(adminClient, {
      organizationId: input.organizationId,
      branding: merged,
      expectedRevision: input.expectedRevision,
    });

    if (!saveRes.ok) {
      if (saveRes.code === "revision_conflict") {
        return {
          ok: false as const,
          error: saveRes.message,
          errorKind: "revision_conflict" as const,
        };
      }
      if (saveRes.code === "invalid_input") {
        return {
          ok: false as const,
          error: saveRes.message,
          errorKind: "validation" as const,
        };
      }
      return {
        ok: false as const,
        error: saveRes.message,
        errorKind: (saveRes.code === "not_found" ? "not_found" : "unexpected") as OrganizationBrandingActionErrorKind,
      };
    }

    revalidatePath(`/super-admin/${input.organizationId}`);
    revalidatePath(`/super-admin/${input.organizationId}/branding`);

    return {
      ok: true as const,
      brandingRevision: saveRes.data.brandingRevision,
    };
  }).catch((error) => {
    captureServerActionError("organizationBranding.save", error);
    return { ok: false, error: "Branding kaydedilemedi.", errorKind: "unexpected" as const };
  });
}
