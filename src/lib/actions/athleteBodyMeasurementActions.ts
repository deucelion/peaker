"use server";

import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import {
  mapBodyMeasurementRow,
  parseBodyMeasurementInput,
  type AthleteBodyMeasurementRow,
} from "@/lib/athlete/bodyMeasurement";
import { isOrganizationEntitlementEnabled } from "@/lib/auth/serverActionFeatureAccess";
import { ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";

const MEASUREMENT_SELECT =
  "id, profile_id, organization_id, measurement_date, height, weight, body_fat, note, recorded_by, created_at, updated_at";

type UpsertBodyMeasurementArgs = {
  profileId: string;
  organizationId: string;
  measurementDate: string;
  height: number | null;
  weight: number | null;
  note: string | null;
  recordedBy: string;
};

export async function upsertAthleteBodyMeasurement(args: UpsertBodyMeasurementArgs) {
  const adminClient = createSupabaseAdminClient();
  const { data: existing } = await adminClient
    .from("athlete_metrics")
    .select("id, height, weight, body_fat")
    .eq("profile_id", args.profileId)
    .eq("measurement_date", args.measurementDate)
    .maybeSingle();

  const payload = {
    profile_id: args.profileId,
    organization_id: args.organizationId,
    measurement_date: args.measurementDate,
    height: args.height ?? existing?.height ?? null,
    weight: args.weight ?? existing?.weight ?? null,
    body_fat: existing?.body_fat ?? null,
    note: args.note,
    recorded_by: args.recordedBy,
    updated_at: new Date().toISOString(),
  };

  const { error } = await adminClient.from("athlete_metrics").upsert([payload], {
    onConflict: "profile_id,measurement_date",
  });
  if (error) return { error: `Olçüm kaydedilemedi: ${error.message}` as const };

  const { data: persisted, error: verifyError } = await adminClient
    .from("athlete_metrics")
    .select("id")
    .eq("profile_id", args.profileId)
    .eq("organization_id", args.organizationId)
    .eq("measurement_date", args.measurementDate)
    .maybeSingle();
  if (verifyError || !persisted) {
    return { error: "Olçüm kaydedilemedi: doğrulama başarısız." as const };
  }

  const profilePatch: { height?: number | null; weight?: number | null } = {};
  if (args.height != null) profilePatch.height = args.height;
  if (args.weight != null) profilePatch.weight = args.weight;
  if (Object.keys(profilePatch).length > 0) {
    const { data: profileRow, error: profileError } = await adminClient
      .from("profiles")
      .update(profilePatch)
      .eq("id", args.profileId)
      .eq("organization_id", args.organizationId)
      .select("id")
      .maybeSingle();
    if (profileError || !profileRow) {
      return { error: "Profil ölçüleri güncellenemedi." as const };
    }
  }

  return { success: true as const };
}

async function listMeasurementsForProfile(profileId: string): Promise<AthleteBodyMeasurementRow[]> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("athlete_metrics")
    .select(MEASUREMENT_SELECT)
    .eq("profile_id", profileId)
    .order("measurement_date", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => mapBodyMeasurementRow(row as Record<string, unknown>));
}

async function resolveActiveAthleteActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error } as const;
  const actor = resolved.actor;
  if (!actor.organizationId) return { error: "Profil dogrulanamadi." as const };
  if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu islem yalnizca sporcu hesabi icindir." as const };
  const block = messageIfAthleteCannotOperate(actor.role, actor.isActive);
  if (block) return { error: block };
  return { actor, organizationId: actor.organizationId };
}

async function resolveManagementActorForAthlete(athleteId: string, requireManage = false) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error } as const;
  const actor = resolved.actor;
  if (!actor.organizationId) return { error: "Organizasyon bilgisi alinamadi." as const };

  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.isActive);
  if (coachBlock) return { error: coachBlock };

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: "Bu islem icin yetkiniz yok." as const };
  }
  if (role === "coach") {
    const perms = await getCoachPermissions(actor.id, actor.organizationId);
    if (!perms.can_view_all_athletes) {
      return { error: "Sporcu detayini goruntuleme yetkiniz yok." as const };
    }
    if (requireManage && !perms.can_manage_athlete_profiles) {
      return { error: "Sporcu guncelleme yetkiniz yok." as const };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id, full_name, email, height, weight")
    .eq("id", athleteId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu") {
    return { error: "Sporcu bulunamadi veya erisim reddedildi." as const };
  }

  return {
    actor,
    organizationId: actor.organizationId,
    athlete: {
      ...athlete,
      full_name: toDisplayName(athlete.full_name, athlete.email, "Sporcu"),
    },
  };
}

export async function listMyBodyMeasurements() {
  return withServerActionGuard("bodyMeasurement.listMyBodyMeasurements", async () => {
    const gate = await resolveActiveAthleteActor();
    if ("error" in gate) return { error: gate.error };
    const rows = await listMeasurementsForProfile(gate.actor.id);
    return { measurements: rows };
  });
}

export async function recordMyBodyMeasurement(input: {
  measurementDate?: string;
  height?: string | number | null;
  weight?: string | number | null;
  note?: string | null;
}) {
  return withServerActionGuard("bodyMeasurement.recordMyBodyMeasurement", async () => {
    const gate = await resolveActiveAthleteActor();
    if ("error" in gate) return { error: gate.error };

    const parsed = parseBodyMeasurementInput(input);
    if (!parsed.ok) return { error: parsed.error };

    const result = await upsertAthleteBodyMeasurement({
      profileId: gate.actor.id,
      organizationId: gate.organizationId,
      measurementDate: parsed.value.measurementDate,
      height: parsed.value.height,
      weight: parsed.value.weight,
      note: parsed.value.note,
      recordedBy: gate.actor.id,
    });
    if ("error" in result) return result;

    revalidatePath("/sporcu");
    revalidatePath(`/sporcu/${gate.actor.id}`);
    return { success: true as const };
  });
}

export async function listAthleteBodyMeasurementsForManagement(athleteId: string) {
  return withServerActionGuard("bodyMeasurement.listAthleteBodyMeasurementsForManagement", async () => {
    if (!isUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." };
    const gate = await resolveManagementActorForAthlete(athleteId, false);
    if ("error" in gate) return { error: gate.error };
    const rows = await listMeasurementsForProfile(athleteId);
    return {
      measurements: rows,
      athlete: {
        id: gate.athlete.id,
        full_name: gate.athlete.full_name,
        height: gate.athlete.height,
        weight: gate.athlete.weight,
      },
      canManage: getSafeRole(gate.actor.role) === "admin" || (await getCoachPermissions(gate.actor.id, gate.organizationId)).can_manage_athlete_profiles,
    };
  });
}

export async function recordAthleteBodyMeasurementForManagement(
  athleteId: string,
  input: {
    measurementDate?: string;
    height?: string | number | null;
    weight?: string | number | null;
    note?: string | null;
  }
) {
  return withServerActionGuard("bodyMeasurement.recordAthleteBodyMeasurementForManagement", async () => {
    if (!isUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." };
    const gate = await resolveManagementActorForAthlete(athleteId, true);
    if ("error" in gate) return { error: gate.error };

    const parsed = parseBodyMeasurementInput(input);
    if (!parsed.ok) return { error: parsed.error };

    const result = await upsertAthleteBodyMeasurement({
      profileId: athleteId,
      organizationId: gate.organizationId,
      measurementDate: parsed.value.measurementDate,
      height: parsed.value.height,
      weight: parsed.value.weight,
      note: parsed.value.note,
      recordedBy: gate.actor.id,
    });
    if ("error" in result) return result;

    revalidatePath(`/sporcu/${athleteId}`);
    revalidatePath("/oyuncular");
    return { success: true as const };
  });
}

/**
 * Profil güncellemelerinden otomatik ölçüm kaydı (aynı gün upsert).
 * Çağıran action'lar `core`/`athlete` namespace'lerinde olabildiği için ölçüm
 * entitlement'ı burada ayrıca doğrulanır; kapalıysa sessizce atlanır.
 */
export async function syncBodyMeasurementFromProfileUpdate(args: {
  profileId: string;
  organizationId: string;
  recordedBy: string;
  height: number | null;
  weight: number | null;
}) {
  if (args.height == null && args.weight == null) return { success: true as const };

  const enabled = await isOrganizationEntitlementEnabled(
    ENTITLEMENT_KEYS.insightBodyMeasurements,
    args.organizationId
  );
  if (!enabled) return { success: true as const };
  const measurementDate = new Date().toISOString().split("T")[0]!;
  return upsertAthleteBodyMeasurement({
    profileId: args.profileId,
    organizationId: args.organizationId,
    measurementDate,
    height: args.height,
    weight: args.weight,
    note: null,
    recordedBy: args.recordedBy,
  });
}
