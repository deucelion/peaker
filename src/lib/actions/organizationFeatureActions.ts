"use server";

import { revalidatePath } from "next/cache";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { captureServerActionError, withServerActionGuard } from "@/lib/observability/serverActionError";
import {
  getOrganizationFeatureConfigurationFromAdminClient,
  saveOrganizationFeatureConfigurationFromAdminClient,
} from "@/lib/organization/features/persistence/organizationFeaturesRepository";
import type {
  FeatureOverrides,
  FeaturePresetId,
  OrganizationFeatures,
} from "@/lib/organization/features/types";
import { validateOverrideKeys, validatePresetId } from "@/lib/organization/features/validation";
import { createSupabaseAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export type OrganizationFeatureEditorSnapshot = {
  organizationId: string;
  organizationName: string;
  featurePreset: FeaturePresetId;
  featureOverrides: FeatureOverrides;
  features: OrganizationFeatures;
  featuresRevision: number;
};

export type SaveOrganizationFeaturePresetActionInput = {
  organizationId: string;
  expectedRevision: number;
  preset: string;
  /**
   * Yalnizca `custom` preset icin anlamlidir ve her zaman sunucuda dogrulanir.
   * Verilmezse mevcut kayitli override'lar korunur (Faz 37 davranisi).
   */
  overrides?: Record<string, unknown>;
};

export type OrganizationFeatureActionErrorKind =
  | "permission"
  | "validation"
  | "revision_conflict"
  | "not_found"
  | "unexpected";

export type SaveOrganizationFeaturePresetActionResult =
  | {
      ok: true;
      featuresRevision: number;
      featurePreset: FeaturePresetId;
      featureOverrides: FeatureOverrides;
      features: OrganizationFeatures;
    }
  | { ok: false; error: string; errorKind: OrganizationFeatureActionErrorKind };

export type LoadOrganizationFeatureActionResult =
  | { ok: true; snapshot: OrganizationFeatureEditorSnapshot }
  | { ok: false; error: string; errorKind: OrganizationFeatureActionErrorKind };

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

type NormalizedOverridesResult =
  | { ok: true; overrides: FeatureOverrides }
  | { ok: false; error: string };

/**
 * Client'tan gelen override yuku hicbir sekilde guvenilmez kabul edilir.
 * Anahtar/deger dogrulamasi icin mevcut `validateOverrideKeys` kullanilir.
 */
function normalizeOverridesInput(raw: Record<string, unknown> | undefined): NormalizedOverridesResult {
  if (raw === undefined || raw === null) {
    return { ok: true, overrides: {} };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Gecersiz ozellik override yapisi." };
  }

  const validation = validateOverrideKeys(raw as FeatureOverrides);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  const overrides: FeatureOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    overrides[key as keyof FeatureOverrides] = value as boolean;
  }
  return { ok: true, overrides };
}

export async function loadOrganizationFeatureEditorSnapshot(
  organizationId: string
): Promise<LoadOrganizationFeatureActionResult> {
  return withServerActionGuard("organizationFeature.loadEditorSnapshot", async () => {
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

    const configRes = await getOrganizationFeatureConfigurationFromAdminClient(adminClient, organizationId);
    if (!configRes.ok) {
      return {
        ok: false as const,
        error: configRes.message,
        errorKind: (configRes.code === "not_found" ? "not_found" : "unexpected") as OrganizationFeatureActionErrorKind,
      };
    }

    return {
      ok: true as const,
      snapshot: {
        organizationId,
        organizationName: orgRes.data.name || `ORG-${organizationId.slice(0, 8).toUpperCase()}`,
        featurePreset: configRes.data.featurePreset,
        featureOverrides: configRes.data.featureOverrides,
        features: configRes.data.features,
        featuresRevision: configRes.data.featuresRevision,
      },
    };
  }).catch((error) => {
    captureServerActionError("organizationFeature.loadEditorSnapshot", error);
    return { ok: false, error: "Paket verisi yuklenemedi.", errorKind: "unexpected" as const };
  });
}

export async function saveOrganizationFeaturePresetAction(
  input: SaveOrganizationFeaturePresetActionInput
): Promise<SaveOrganizationFeaturePresetActionResult> {
  return withServerActionGuard("organizationFeature.savePreset", async () => {
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
        error: "Gecersiz features revision.",
        errorKind: "validation" as const,
      };
    }

    const presetValidation = validatePresetId(input.preset);
    if (!presetValidation.ok) {
      return {
        ok: false as const,
        error: presetValidation.errors.join(" "),
        errorKind: "validation" as const,
      };
    }
    const preset = input.preset as FeaturePresetId;

    const normalizedOverrides = normalizeOverridesInput(input.overrides);
    if (!normalizedOverrides.ok) {
      return {
        ok: false as const,
        error: normalizedOverrides.error,
        errorKind: "validation" as const,
      };
    }

    const adminClient = createSupabaseAdminClient();
    const currentRes = await getOrganizationFeatureConfigurationFromAdminClient(
      adminClient,
      input.organizationId
    );
    if (!currentRes.ok) {
      return {
        ok: false as const,
        error: currentRes.message,
        errorKind: (currentRes.code === "not_found" ? "not_found" : "unexpected") as OrganizationFeatureActionErrorKind,
      };
    }

    // Named preset → repository varsayilani olan bos override ile temiz atama.
    // `custom` → cagirandan gelen override'lar; verilmediyse kayitli olanlar korunur.
    const nextOverrides: FeatureOverrides =
      preset === "custom"
        ? input.overrides === undefined
          ? currentRes.data.featureOverrides
          : normalizedOverrides.overrides
        : {};

    const saveRes = await saveOrganizationFeatureConfigurationFromAdminClient(adminClient, {
      organizationId: input.organizationId,
      preset,
      overrides: nextOverrides,
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
        errorKind: (saveRes.code === "not_found" ? "not_found" : "unexpected") as OrganizationFeatureActionErrorKind,
      };
    }

    revalidatePath(`/super-admin/${input.organizationId}`);
    revalidatePath(`/super-admin/${input.organizationId}/package`);

    return {
      ok: true as const,
      featuresRevision: saveRes.data.featuresRevision,
      featurePreset: saveRes.data.featurePreset,
      featureOverrides: saveRes.data.featureOverrides,
      features: saveRes.data.features,
    };
  }).catch((error) => {
    captureServerActionError("organizationFeature.savePreset", error);
    return { ok: false, error: "Paket kaydedilemedi.", errorKind: "unexpected" as const };
  });
}
