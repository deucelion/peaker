"use server";


import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

function toLocalDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function resolveAthleteForSurvey() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };

  const actor = resolved.actor;
  if (!actor.organizationId) return { error: "Profil dogrulanamadi." as const };
  if (actor.id == null || actor.id.trim() === "") return { error: "Profil dogrulanamadi." as const };
  if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu form yalnizca sporcu hesabi icindir." as const };

  const block = messageIfAthleteCannotOperate(actor.role, actor.isActive);
  if (block) return { error: block };

  const adminClient = createSupabaseAdminClient();
  const { data: perm } = await adminClient
    .from("athlete_permissions")
    .select("can_view_rpe_entry")
    .eq("athlete_id", actor.id)
    .maybeSingle();

  if ((perm?.can_view_rpe_entry ?? true) === false) {
    return { error: "RPE girisi sizin icin kapali." as const };
  }

  return { userId: actor.id, organizationId: actor.organizationId, adminClient };
}

async function upsertTrainingLoadCompat(args: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  duration: number;
  rpe: number;
  sessionType: string;
  totalLoad: number;
  measurementDate: string;
}): Promise<{ error?: string }> {
  const payload = {
    profile_id: args.userId,
    duration_minutes: args.duration,
    rpe_score: args.rpe,
    session_type: args.sessionType,
    total_load: args.totalLoad,
    measurement_date: args.measurementDate,
  };

  const upsertRes = await args.adminClient
    .from("training_loads")
    .upsert(payload, { onConflict: "profile_id,measurement_date" });

  if (!upsertRes.error) return {};

  const conflictMessage = `${upsertRes.error.code || ""} ${upsertRes.error.message || ""}`.toLowerCase();
  const conflictConstraintMissing =
    conflictMessage.includes("42p10") ||
    conflictMessage.includes("no unique") ||
    conflictMessage.includes("on conflict specification");

  if (!conflictConstraintMissing) {
    return { error: `Kayit basarisiz: ${upsertRes.error.message}` };
  }

  const existing = await args.adminClient
    .from("training_loads")
    .select("id")
    .eq("profile_id", args.userId)
    .eq("measurement_date", args.measurementDate)
    .maybeSingle();

  if (existing.error) {
    return { error: `Kayit basarisiz: ${existing.error.message}` };
  }

  if (existing.data?.id) {
    const updateRes = await args.adminClient
      .from("training_loads")
      .update(payload)
      .eq("id", existing.data.id);
    if (updateRes.error) {
      return { error: `Kayit basarisiz: ${updateRes.error.message}` };
    }
    return {};
  }

  const insertRes = await args.adminClient.from("training_loads").insert(payload);
  if (insertRes.error) {
    return { error: `Kayit basarisiz: ${insertRes.error.message}` };
  }

  return {};
}

export async function getRpeSurveyEligibility() {
  return withServerActionGuard("trainingLoadSurvey.getRpeSurveyEligibility", async () => {
  const r = await resolveAthleteForSurvey();
  if ("error" in r) return { allowed: false as const };
  return { allowed: true as const };
  });
}

export async function submitAthleteTrainingLoadSurvey(input: {
  sessionDate: string;
  durationMinutes: number;
  rpeScore: number;
  sessionType: string;
}) {
  return withServerActionGuard("trainingLoadSurvey.submitAthleteTrainingLoadSurvey", async () => {
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

  const save = await upsertTrainingLoadCompat({
    adminClient: resolved.adminClient,
    userId: resolved.userId,
    duration,
    rpe,
    sessionType,
    totalLoad,
    measurementDate,
  });
  if (save.error) return { error: save.error };

  revalidatePath("/anket");
  revalidatePath("/performans");
  return { success: true as const };
  });
}
