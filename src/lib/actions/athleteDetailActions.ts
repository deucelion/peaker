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

  const [packageRes, privatePaymentRes, aidatRes, lessonRes, injuryRes, programRes] = await Promise.all([
    adminClient
      .from("private_lesson_packages")
      .select("id, package_name, remaining_lessons, payment_status, is_active, total_lessons, used_lessons, total_price, amount_paid, updated_at")
      .eq("organization_id", actor.organization_id)
      .eq("athlete_id", athleteId)
      .order("updated_at", { ascending: false })
      .limit(5),
    adminClient
      .from("private_lesson_payments")
      .select("id, amount, paid_at, note")
      .eq("organization_id", actor.organization_id)
      .eq("athlete_id", athleteId)
      .order("paid_at", { ascending: false })
      .limit(40),
    adminClient
      .from("payments")
      .select("id, amount, payment_date, due_date, status, payment_type, description")
      .eq("organization_id", actor.organization_id)
      .eq("profile_id", athleteId)
      .order("due_date", { ascending: false })
      .limit(40),
    adminClient
      .from("training_participants")
      .select("training_schedule!inner(id, title, start_time, end_time, location, status)")
      .eq("profile_id", athleteId)
      .eq("training_schedule.organization_id", actor.organization_id)
      .order("start_time", { ascending: false, referencedTable: "training_schedule" })
      .limit(30),
    adminClient
      .from("athlete_injury_notes")
      .select("id, injury_type, note, created_at, is_active")
      .eq("organization_id", actor.organization_id)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(30),
    adminClient
      .from("athlete_programs")
      .select("id, title, created_at, note, is_active")
      .eq("organization_id", actor.organization_id)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const activePackage = (packageRes.data || []).find((p) => p.is_active) || (packageRes.data || [])[0] || null;

  const timelineEvents = [
    ...((lessonRes.data || []).map((row) => {
      const schedule = Array.isArray(row.training_schedule) ? row.training_schedule[0] : row.training_schedule;
      return {
        id: `lesson-${schedule?.id || crypto.randomUUID()}`,
        type: "lesson",
        at: schedule?.start_time || new Date(0).toISOString(),
        title: schedule?.title || "Ders",
        detail: `${schedule?.location || "Lokasyon yok"} · ${schedule?.status || "scheduled"}`,
      };
    }) || []),
    ...((privatePaymentRes.data || []).map((row) => ({
      id: `private-payment-${row.id}`,
      type: "payment",
      at: row.paid_at || new Date(0).toISOString(),
      title: `Özel ders ödeme: ₺${Number(row.amount || 0)}`,
      detail: row.note || "Özel ders tahsilatı",
    })) || []),
    ...((aidatRes.data || []).map((row) => ({
      id: `aidat-${row.id}`,
      type: "payment",
      at: row.payment_date || row.due_date || new Date(0).toISOString(),
      title: `${row.payment_type === "aylik" ? "Aidat" : "Paket"} ödeme: ₺${Number(row.amount || 0)}`,
      detail: `${row.status || "bekliyor"} · ${row.description || "Ödeme kaydı"}`,
    })) || []),
    ...((injuryRes.data || []).map((row) => ({
      id: `injury-${row.id}`,
      type: "injury",
      at: row.created_at || new Date(0).toISOString(),
      title: row.injury_type || "Sakatlık kaydı",
      detail: row.note || (row.is_active ? "Aktif sakatlık kaydı" : "Pasif sakatlık kaydı"),
    })) || []),
    ...((programRes.data || []).map((row) => ({
      id: `program-${row.id}`,
      type: "note",
      at: row.created_at || new Date(0).toISOString(),
      title: row.title || "Program notu",
      detail: row.note || (row.is_active ? "Aktif program notu" : "Pasif program notu"),
    })) || []),
  ]
    .filter((event) => event.at && !Number.isNaN(new Date(event.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    profile: prof,
    results: results ?? [],
    loads: loads ?? [],
    wellnessReports: wellnessRows ?? [],
    bodyMetrics,
    financeAndPackage: {
      activePackageName: activePackage?.package_name ?? null,
      remainingLessons: activePackage?.remaining_lessons ?? null,
      paymentStatus: activePackage?.payment_status ?? null,
      packageSummary: activePackage
        ? {
            totalLessons: activePackage.total_lessons,
            usedLessons: activePackage.used_lessons,
            totalPrice: Number(activePackage.total_price || 0),
            amountPaid: Number(activePackage.amount_paid || 0),
          }
        : null,
    },
    timelineEvents,
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
    if (!coachPerms.can_manage_athlete_profiles) {
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

export async function updateAthleteProfileForManagement(
  athleteId: string,
  updates: {
    fullName: string;
    team: string;
    position: string;
    number: string;
    height: string;
    weight: string;
  }
) {
  if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." as const };
  const gate = await resolveManagementActorForAthleteMutations();
  if ("error" in gate) return { error: gate.error };

  const fullName = updates.fullName.trim();
  const team = updates.team.trim();
  const position = updates.position.trim();
  const number = updates.number.trim();
  const heightNum = updates.height.trim() ? Number(updates.height) : null;
  const weightNum = updates.weight.trim() ? Number(updates.weight) : null;

  if (!fullName) return { error: "Ad soyad zorunludur." as const };
  if (fullName.length > 120) return { error: "Ad soyad en fazla 120 karakter olabilir." as const };
  if (team.length > 80) return { error: "Takim adi en fazla 80 karakter olabilir." as const };
  if (position.length > 24) return { error: "Pozisyon en fazla 24 karakter olabilir." as const };
  if (number.length > 16) return { error: "Forma numarasi en fazla 16 karakter olabilir." as const };
  if (heightNum != null && (!Number.isFinite(heightNum) || heightNum < 50 || heightNum > 260)) {
    return { error: "Boy 50-260 araliginda olmali." as const };
  }
  if (weightNum != null && (!Number.isFinite(weightNum) || weightNum < 20 || weightNum > 300)) {
    return { error: "Kilo 20-300 araliginda olmali." as const };
  }

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
    .update({
      full_name: fullName,
      team: team || null,
      position: position || null,
      number: number || null,
      height: heightNum,
      weight: weightNum,
    })
    .eq("id", athleteId)
    .eq("organization_id", gate.actor.organization_id);
  if (error) return { error: `Sporcu profili guncellenemedi: ${error.message}` as const };

  revalidatePath(`/sporcu/${athleteId}`);
  revalidatePath("/oyuncular");
  revalidatePath("/takimlar");
  return { success: true as const };
}
