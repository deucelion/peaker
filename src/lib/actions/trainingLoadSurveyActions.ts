"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";

function toLocalDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function resolveAthleteForSurvey() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return { error: "Gecersiz oturum." as const };

  const adminClient = createSupabaseAdminClient();
  const { data: actor } = await adminClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!actor?.organization_id) return { error: "Profil dogrulanamadi." as const };
  if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu form yalnizca sporcu hesabi icindir." as const };

  const block = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (block) return { error: block };

  const { data: perm } = await adminClient
    .from("athlete_permissions")
    .select("can_view_rpe_entry")
    .eq("athlete_id", actor.id)
    .maybeSingle();

  if ((perm?.can_view_rpe_entry ?? true) === false) {
    return { error: "RPE girisi sizin icin kapali." as const };
  }

  return { userId: actor.id, organizationId: actor.organization_id, adminClient };
}

export async function getRpeSurveyEligibility() {
  const r = await resolveAthleteForSurvey();
  if ("error" in r) return { allowed: false as const };
  return { allowed: true as const };
}

export async function submitAthleteTrainingLoadSurvey(input: {
  sessionDate: string;
  durationMinutes: number;
  rpeScore: number;
  sessionType: string;
}) {
  const resolved = await resolveAthleteForSurvey();
  if ("error" in resolved) return { error: resolved.error };

  const dateStr = input.sessionDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "Gecersiz tarih." };

  const maxStr = toLocalDateInput(new Date());
  const minD = new Date();
  minD.setDate(minD.getDate() - 30);
  const minStr = toLocalDateInput(minD);
  if (dateStr < minStr || dateStr > maxStr) return { error: "Tarih en fazla 30 gun geriye olabilir." };

  const duration = Number(input.durationMinutes);
  if (!Number.isInteger(duration) || duration < 15 || duration > 300) {
    return { error: "Sure 15–300 dakika araliginda olmalidir." };
  }

  const rpe = Number(input.rpeScore);
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { error: "RPE 1–10 arasi olmalidir." };

  const sessionType = input.sessionType?.trim().slice(0, 120) || "Antrenman";
  if (sessionType.length < 2) return { error: "Seans turu en az 2 karakter olmalidir." };

  const measurementDate = `${dateStr}T12:00:00.000Z`;
  const totalLoad = duration * rpe;

  const { error } = await resolved.adminClient.from("training_loads").upsert(
    {
      profile_id: resolved.userId,
      duration_minutes: duration,
      rpe_score: rpe,
      session_type: sessionType,
      total_load: totalLoad,
      measurement_date: measurementDate,
    },
    { onConflict: "profile_id,measurement_date" }
  );

  if (error) return { error: `Kayit basarisiz: ${error.message}` };

  revalidatePath("/anket");
  revalidatePath("/performans");
  return { success: true as const };
}
