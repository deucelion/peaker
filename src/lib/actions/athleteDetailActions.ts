"use server";

import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { toDisplayName } from "@/lib/profile/displayName";
import { isUuid } from "@/lib/validation/uuid";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

export async function loadAthleteDetailForManagement(athleteId: string) {
  if (!assertUuid(athleteId)) {
    return { error: "Gecersiz sporcu kimligi." as const };
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminClient = createSupabaseAdminClient();
    const byId = await adminClient
      .from("profiles")
      .select("id, role, organization_id, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
    if (!actor && authData.user.email) {
      const byEmail = await adminClient
        .from("profiles")
        .select("id, role, organization_id, is_active")
        .eq("email", authData.user.email)
        .limit(1)
        .maybeSingle();
      actor = byEmail.data ?? null;
    }
  }
  if (!actor) {
    const claimRole = extractSessionRole(authData.user);
    const claimOrg = extractSessionOrganizationId(authData.user);
    if (claimRole && claimOrg) {
      actor = {
        id: authData.user.id,
        role: claimRole,
        organization_id: claimOrg,
        is_active: true,
      };
    }
  }

  if (!actor?.organization_id) {
    return { error: "Kullanici profili dogrulanamadi." as const };
  }

  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };

  const actorRole = getSafeRole(actor.role);
  if (actorRole !== "admin" && actorRole !== "coach") {
    return { error: "Bu sayfaya erisim yetkiniz yok." as const };
  }

  if (actorRole === "coach") {
    const coachPerms = await getCoachPermissions(actor.id, actor.organization_id);
    if (!coachPerms.can_view_all_athletes) {
      return { error: "Sporcu detayini goruntuleme yetkiniz yok." as const };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data: prof, error: profError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", athleteId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();

  if (profError || !prof || getSafeRole(prof.role) !== "sporcu") {
    return { error: "Sporcu bulunamadi veya erisim reddedildi." as const };
  }
  prof.full_name = toDisplayName(prof.full_name, prof.email, "Sporcu");

  const [{ data: results }, { data: loads }, { data: wellnessRows }] = await Promise.all([
    adminClient
      .from("athletic_results")
      .select("value, test_date, test_id, test_definitions (id, name, unit)")
      .eq("profile_id", athleteId)
      .order("test_date", { ascending: false }),
    adminClient
      .from("training_loads")
      .select("profile_id, total_load, rpe_score, measurement_date")
      .eq("profile_id", athleteId)
      .order("measurement_date", { ascending: true }),
    adminClient
      .from("wellness_reports")
      .select(
        "id, profile_id, report_date, resting_heart_rate, fatigue, sleep_quality, muscle_soreness, stress_level, energy_level, notes"
      )
      .eq("profile_id", athleteId)
      .order("report_date", { ascending: false })
      .limit(120),
  ]);

  const bodyRes = await adminClient
    .from("athlete_metrics")
    .select("measurement_date, weight, body_fat")
    .eq("profile_id", athleteId)
    .order("measurement_date", { ascending: true });
  const bodyMetrics = bodyRes.error ? [] : bodyRes.data ?? [];

  return {
    profile: prof,
    results: results ?? [],
    loads: loads ?? [],
    wellnessReports: wellnessRows ?? [],
    bodyMetrics,
  };
}

async function resolveManagementActorForAthleteMutations() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminClient = createSupabaseAdminClient();
    const byId = await adminClient
      .from("profiles")
      .select("id, role, organization_id, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
  }
  if (!actor?.organization_id) {
    return { error: "Kullanici profili dogrulanamadi." as const };
  }

  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };

  const actorRole = getSafeRole(actor.role);
  if (actorRole !== "admin" && actorRole !== "coach") {
    return { error: "Bu islem icin yetkiniz yok." as const };
  }
  if (actorRole === "coach") {
    const coachPerms = await getCoachPermissions(actor.id, actor.organization_id);
    if (!coachPerms.can_view_all_athletes) {
      return { error: "Sporcu guncelleme yetkiniz yok." as const };
    }
  }
  return { actor };
}

export async function listPositionOptionsForManagement() {
  const gate = await resolveManagementActorForAthleteMutations();
  if ("error" in gate) return { error: gate.error };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("position")
    .eq("organization_id", gate.actor.organization_id)
    .eq("role", "sporcu");

  if (error) return { error: `Pozisyonlar alinamadi: ${error.message}` };
  const positions = Array.from(
    new Set(
      (data || [])
        .map((row) => (row.position || "").trim())
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "tr"));

  return { positions };
}

export async function updateAthletePositionForManagement(athleteId: string, nextPositionRaw: string) {
  if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." as const };

  const gate = await resolveManagementActorForAthleteMutations();
  if ("error" in gate) return { error: gate.error };
  const nextPosition = nextPositionRaw.trim();
  if (nextPosition.length > 24) return { error: "Pozisyon en fazla 24 karakter olabilir." as const };

  const adminClient = createSupabaseAdminClient();
  const { data: target, error: tErr } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", athleteId)
    .eq("organization_id", gate.actor.organization_id)
    .maybeSingle();
  if (tErr || !target || getSafeRole(target.role) !== "sporcu") {
    return { error: "Sporcu bulunamadi veya erisim reddedildi." as const };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ position: nextPosition || null })
    .eq("id", athleteId)
    .eq("organization_id", gate.actor.organization_id);
  if (error) return { error: `Pozisyon guncellenemedi: ${error.message}` as const };

  revalidatePath(`/sporcu/${athleteId}`);
  revalidatePath("/oyuncular");
  return { success: true as const };
}
