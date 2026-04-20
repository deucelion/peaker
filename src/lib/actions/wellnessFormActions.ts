"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import type { WellnessReportRow } from "@/types/performance";

/** Sabah raporu vb. formlar: sporcu organization_id sunucu doğrulamalı (RLS’e güvenilmez). */
export async function getAthleteOrganizationIdForWellness() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: row, error } = await adminClient
    .from("profiles")
    .select("organization_id, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !row?.organization_id || getSafeRole(row.role) !== "sporcu") {
    return { error: "Organizasyon bilgisi alinamadi." as const };
  }

  return { organizationId: row.organization_id };
}

export async function getMorningReportEligibility() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return { allowed: false as const };

  const adminClient = createSupabaseAdminClient();
  const { data: row } = await adminClient
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!row?.organization_id || getSafeRole(row.role) !== "sporcu") return { allowed: false as const };
  const block = messageIfAthleteCannotOperate(row.role, row.is_active);
  if (block) return { allowed: false as const, message: block };

  const { data: perm } = await adminClient
    .from("athlete_permissions")
    .select("can_view_morning_report")
    .eq("athlete_id", row.id)
    .maybeSingle();

  return { allowed: (perm?.can_view_morning_report ?? true) as boolean };
}

function clampScale(n: number) {
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 1 || v > 5) return null;
  return v;
}

export async function submitWellnessReportToday(input: {
  fatigue: number;
  sleep_quality: number;
  muscle_soreness: number;
  stress_level: number;
  energy_level: number;
  resting_heart_rate: number;
}) {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return { error: "Gecersiz oturum." as const };

  const adminClient = createSupabaseAdminClient();
  const { data: row } = await adminClient
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!row?.organization_id || getSafeRole(row.role) !== "sporcu") {
    return { error: "Bu islem yalnizca sporcu hesabi icindir." as const };
  }
  const block = messageIfAthleteCannotOperate(row.role, row.is_active);
  if (block) return { error: block };

  const { data: perm } = await adminClient
    .from("athlete_permissions")
    .select("can_view_morning_report")
    .eq("athlete_id", row.id)
    .maybeSingle();
  if ((perm?.can_view_morning_report ?? true) === false) {
    return { error: "Sabah raporu sizin icin kapali." as const };
  }

  const fatigue = clampScale(input.fatigue);
  const sleep_quality = clampScale(input.sleep_quality);
  const muscle_soreness = clampScale(input.muscle_soreness);
  const stress_level = clampScale(input.stress_level);
  const energy_level = clampScale(input.energy_level);
  if (
    fatigue === null ||
    sleep_quality === null ||
    muscle_soreness === null ||
    stress_level === null ||
    energy_level === null
  ) {
    return { error: "Olcek degerleri 1–5 arasinda olmalidir." };
  }

  const rhr = Number(input.resting_heart_rate);
  if (!Number.isFinite(rhr) || rhr < 30 || rhr > 220) {
    return { error: "Nabiz 30–220 araliginda olmalidir." };
  }

  const report_date = new Date().toISOString().split("T")[0];

  const { error } = await adminClient.from("wellness_reports").upsert(
    [
      {
        profile_id: row.id,
        organization_id: row.organization_id,
        fatigue,
        sleep_quality,
        muscle_soreness,
        stress_level,
        energy_level,
        resting_heart_rate: Math.round(rhr),
        report_date,
      },
    ],
    { onConflict: "profile_id,report_date" }
  );

  if (error) return { error: `Rapor kaydedilemedi: ${error.message}` };

  revalidatePath("/sporcu/sabah-raporu");
  revalidatePath("/performans");
  return { success: true as const };
}

/** Koç / admin: organizasyon wellness arşivi (performans wellness-detay sayfası). */
export async function listWellnessArchiveForManagement(): Promise<
  { reports: WellnessReportRow[]; totalAthletes: number } | { error: string }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Profil dogrulanamadi." };

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: "Bu sayfa yalnizca yonetici veya koç icindir." };
  }
  if (role === "coach") {
    const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
    if (coachBlock) return { error: coachBlock };
  }

  const orgId = actor.organization_id;
  const adminClient = createSupabaseAdminClient();
  const permissions =
    role === "coach" ? await getCoachPermissions(actor.id, orgId) : DEFAULT_COACH_PERMISSIONS;
  if (role === "coach" && !hasCoachPermission(permissions, "can_view_reports")) {
    return { error: "Wellness raporlarini goruntuleme yetkiniz yok." };
  }

  const [{ data: reportRows, error: reportErr }, { count: athleteCount, error: countErr }] = await Promise.all([
    adminClient
      .from("wellness_reports")
      .select(
        "id, profile_id, report_date, resting_heart_rate, fatigue, sleep_quality, muscle_soreness, stress_level, energy_level, notes, profiles(full_name, organization_id, avatar_url)"
      )
      .eq("profiles.organization_id", orgId)
      .order("report_date", { ascending: false }),
    adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "sporcu"),
  ]);

  if (reportErr) return { error: `Wellness raporlari alinamadi: ${reportErr.message}` };
  if (countErr) return { error: `Sporcu sayisi alinamadi: ${countErr.message}` };

  type RawWellness = WellnessReportRow & {
    profiles?:
      | { full_name?: string | null; organization_id?: string; avatar_url?: string | null }
      | Array<{ full_name?: string | null; organization_id?: string; avatar_url?: string | null }>
      | null;
  };

  const reports: WellnessReportRow[] = (reportRows || []).map((raw: RawWellness) => {
    const p = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
    return {
      ...raw,
      profiles: p
        ? {
            ...p,
            full_name: toDisplayName(p.full_name, undefined, "Sporcu"),
          }
        : null,
    };
  });

  return { reports, totalAthletes: athleteCount ?? 0 };
}

export type WellnessRadarRow = {
  sleep_quality: number | null;
  fatigue: number | null;
  muscle_soreness: number | null;
  stress_level: number | null;
  energy_level: number | null;
  resting_heart_rate: number | null;
};

/** Sporcu paneli radar: son 14 wellness satırı (org profilden; tarayıcı Supabase yok). */
export async function listWellnessReportsForAthleteRadar(): Promise<
  { rows: WellnessRadarRow[] } | { error: string }
> {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: row } = await adminClient
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!row?.organization_id || getSafeRole(row.role) !== "sporcu") {
    return { rows: [] };
  }
  const block = messageIfAthleteCannotOperate(row.role, row.is_active);
  if (block) {
    return { rows: [] };
  }

  const { data: perm } = await adminClient
    .from("athlete_permissions")
    .select("can_view_wellness_metrics")
    .eq("athlete_id", row.id)
    .maybeSingle();
  if ((perm?.can_view_wellness_metrics ?? true) === false) {
    return { rows: [] };
  }

  const { data, error } = await adminClient
    .from("wellness_reports")
    .select(
      "sleep_quality, fatigue, muscle_soreness, stress_level, energy_level, resting_heart_rate"
    )
    .eq("profile_id", row.id)
    .eq("organization_id", row.organization_id)
    .order("report_date", { ascending: false })
    .limit(14);

  if (error) {
    return { error: `Veri alinamadi: ${error.message}` };
  }

  return { rows: (data || []) as WellnessRadarRow[] };
}
