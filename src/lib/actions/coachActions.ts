"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { COACH_PERMISSION_KEYS, DEFAULT_COACH_PERMISSIONS, type CoachPermissions } from "@/lib/types";
import { normalizeCoachPermissions } from "@/lib/auth/coachPermissions";
import { extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { isUuid } from "@/lib/validation/uuid";
import { normalizeEmailInput, SIMPLE_EMAIL_RE } from "@/lib/email/emailNormalize";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function findAuthUserIdByEmail(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  email: string
): Promise<string | null> {
  const { data: byProfile } = await adminClient.from("profiles").select("id").eq("email", email).maybeSingle();
  if (byProfile?.id) return byProfile.id;

  for (let page = 1; page <= 15; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email);
    if (hit?.id) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

async function ensureCoachPermissionsRow(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  coachId: string,
  organizationId: string
) {
  const { error } = await adminClient.from("coach_permissions").upsert(
    {
      coach_id: coachId,
      organization_id: organizationId,
      can_create_lessons: DEFAULT_COACH_PERMISSIONS.can_create_lessons,
      can_edit_lessons: DEFAULT_COACH_PERMISSIONS.can_edit_lessons,
      can_view_all_organization_lessons: DEFAULT_COACH_PERMISSIONS.can_view_all_organization_lessons,
      can_view_all_athletes: DEFAULT_COACH_PERMISSIONS.can_view_all_athletes,
      can_add_athletes_to_lessons: DEFAULT_COACH_PERMISSIONS.can_add_athletes_to_lessons,
      can_take_attendance: DEFAULT_COACH_PERMISSIONS.can_take_attendance,
      can_view_reports: DEFAULT_COACH_PERMISSIONS.can_view_reports,
      can_manage_training_notes: DEFAULT_COACH_PERMISSIONS.can_manage_training_notes,
      can_manage_athlete_profiles: DEFAULT_COACH_PERMISSIONS.can_manage_athlete_profiles,
      can_manage_teams: DEFAULT_COACH_PERMISSIONS.can_manage_teams,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "coach_id" }
  );
  return error;
}

/**
 * Org admin veya super_admin (hedef org) için koç listesi — RLS / rol string tutarsızlığından etkilenmez.
 */
export async function listCoachesForOrgAdmin(organizationId: string) {
  if (!assertUuid(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." as const };
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminClient = createSupabaseAdminClient();
    const byId = await adminClient
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
    if (!actor) {
      actor = {
        role: extractSessionRole(authData.user),
        organization_id: extractSessionOrganizationId(authData.user),
      };
    }
  }

  const actorRole = getSafeRole(actor?.role);
  if (actorRole === "admin") {
    if (actor?.organization_id !== organizationId) {
      return { error: "Bu organizasyonun koc listesine erisiminiz yok." as const };
    }
  } else if (actorRole !== "super_admin") {
    return { error: "Bu islem icin admin veya super admin yetkisi gerekir." as const };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: `Koc listesi alinamadi: ${error.message}` as const };
  }

  const coaches = (data || []).filter((row) => getSafeRole(row.role) === "coach");
  return { coaches };
}

/**
 * Koçlar listesi sayfası: org çözümü + koç satırları + yaklaşan ders sayıları (tek round-trip).
 * Tarayıcıdan `training_schedule` / `organizations` okumayı önler.
 */
export async function loadCoachesPageData(orgFromQuery: string | null | undefined) {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminPeek = createSupabaseAdminClient();
    const byId = await adminPeek
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
    if (!actor) {
      actor = {
        role: extractSessionRole(authData.user),
        organization_id: extractSessionOrganizationId(authData.user),
      };
    }
  }

  const actorRole = getSafeRole(actor?.role);
  const adminClient = createSupabaseAdminClient();
  let orgId: string | null = null;

  if (actorRole === "admin") {
    orgId = actor?.organization_id ?? null;
    if (!orgId) {
      return { error: "Organizasyon bilgisi alinamadi." as const };
    }
  } else if (actorRole === "super_admin") {
    const q = (orgFromQuery || "").trim();
    if (q) {
      if (!assertUuid(q)) {
        return { error: "Gecersiz organizasyon kimligi." as const };
      }
      orgId = q;
    } else {
      const { data: firstOrg, error: orgErr } = await adminClient
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (orgErr || !firstOrg?.id) {
        return {
          error:
            "Super admin icin organizasyon bulunamadi. Once organizasyon olusturun." as const,
        };
      }
      orgId = firstOrg.id;
    }
  } else {
    return {
      error:
        "Bu sayfaya erisim icin organizasyon admini veya super admin rolune ihtiyaciniz var." as const,
    };
  }

  if (!orgId) {
    return { error: "Organizasyon bilgisi alinamadi." as const };
  }

  const listRes = await listCoachesForOrgAdmin(orgId);
  if ("error" in listRes) {
    return { error: listRes.error };
  }

  const coaches = listRes.coaches || [];
  const upcomingCountByCoach: Record<string, number> = {};
  const lessonCountersByCoach: Record<string, { today: number; upcoming: number; past: number; total: number }> = {};
  const coachIds = coaches.map((c) => c.id).filter(Boolean) as string[];
  if (coachIds.length > 0) {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const { data: groupRows, error: groupErr } = await adminClient
      .from("training_schedule")
      .select("coach_id, start_time")
      .eq("organization_id", orgId)
      .in("coach_id", coachIds)
      .neq("status", "cancelled");
    if (groupErr) {
      return { error: `Ders sayilari alinamadi: ${groupErr.message}` as const };
    }

    const { data: privateRows, error: privateErr } = await adminClient
      .from("private_lesson_sessions")
      .select("coach_id, starts_at")
      .eq("organization_id", orgId)
      .in("coach_id", coachIds)
      .neq("status", "cancelled");
    if (privateErr) {
      return { error: `Ozel ders sayilari alinamadi: ${privateErr.message}` as const };
    }

    for (const coachId of coachIds) {
      lessonCountersByCoach[coachId] = { today: 0, upcoming: 0, past: 0, total: 0 };
    }

    const ingest = (coachId: string | null | undefined, startsAtRaw: string | null | undefined) => {
      if (!coachId || !startsAtRaw) return;
      const startsAt = new Date(startsAtRaw);
      if (Number.isNaN(startsAt.getTime()) || !lessonCountersByCoach[coachId]) return;
      const counters = lessonCountersByCoach[coachId];
      counters.total += 1;
      if (startsAt.getTime() > now.getTime()) counters.upcoming += 1;
      if (startsAt.getTime() < now.getTime()) counters.past += 1;
      if (startsAt.getTime() >= dayStart.getTime() && startsAt.getTime() <= dayEnd.getTime()) counters.today += 1;
    };

    (groupRows || []).forEach((row: { coach_id?: string | null; start_time?: string | null }) => {
      ingest(row.coach_id, row.start_time);
    });
    (privateRows || []).forEach((row: { coach_id?: string | null; starts_at?: string | null }) => {
      ingest(row.coach_id, row.starts_at);
    });

    for (const coachId of coachIds) {
      upcomingCountByCoach[coachId] = lessonCountersByCoach[coachId]?.upcoming || 0;
    }
  }

  return {
    organizationId: orgId,
    coaches,
    upcomingCountByCoach,
    lessonCountersByCoach,
  };
}

export async function getCoachProfileRowForOrgAdmin(coachId: string, organizationId: string) {
  if (!assertUuid(coachId) || !assertUuid(organizationId)) {
    return { error: "Gecersiz kimlik." as const };
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminClient = createSupabaseAdminClient();
    const byId = await adminClient
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
    if (!actor) {
      actor = {
        role: extractSessionRole(authData.user),
        organization_id: extractSessionOrganizationId(authData.user),
      };
    }
  }

  const actorRole = getSafeRole(actor?.role);
  if (actorRole === "admin") {
    if (actor?.organization_id !== organizationId) {
      return { error: "Bu koca erisiminiz yok." as const };
    }
  } else if (actorRole !== "super_admin") {
    return { error: "Bu islem icin admin veya super admin yetkisi gerekir." as const };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: row, error } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", coachId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return { error: `Koc okunamadi: ${error.message}` as const };
  }
  if (!row || getSafeRole(row.role) !== "coach") {
    return { error: "Koc profili bulunamadi." as const };
  }

  return { row };
}

/**
 * Koç detay (?org=): admin / super_admin organizationId — client /api/me-role yok.
 */
export async function resolveOrganizationIdForCoachAdminDetail(orgFromQuery: string | null | undefined) {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminPeek = createSupabaseAdminClient();
    const byId = await adminPeek
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
    if (!actor) {
      actor = {
        role: extractSessionRole(authData.user),
        organization_id: extractSessionOrganizationId(authData.user),
      };
    }
  }

  const actorRole = getSafeRole(actor?.role);
  if (actorRole === "admin") {
    const orgId = actor?.organization_id ?? null;
    if (!orgId) {
      return { error: "Organizasyon bilgisi alinamadi." as const };
    }
    return { organizationId: orgId };
  }
  if (actorRole === "super_admin") {
    const q = (orgFromQuery || "").trim();
    if (!q) {
      return {
        error:
          "Super admin icin ?org=ORG_UUID parametresi gerekir (koc listesinden girin)." as const,
      };
    }
    if (!assertUuid(q)) {
      return { error: "Gecersiz organizasyon kimligi." as const };
    }
    return { organizationId: q };
  }
  return {
    error:
      "Bu sayfaya erisim icin organizasyon admini veya super admin rolune ihtiyaciniz var." as const,
  };
}

export type CoachAdminScheduleRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  location: string | null;
};

/**
 * Koç detay (admin/super_admin): profil satırı + ders programı + coach_permissions — tarayıcı Supabase okuması yok.
 */
export async function loadCoachAdminDetailBundle(coachId: string, organizationId: string) {
  const base = await getCoachProfileRowForOrgAdmin(coachId, organizationId);
  if ("error" in base) {
    return { error: base.error };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: scheduleRows, error: sErr } = await adminClient
    .from("training_schedule")
    .select("id, title, start_time, location")
    .eq("organization_id", organizationId)
    .eq("coach_id", coachId)
    .neq("status", "cancelled");

  if (sErr) {
    return { error: `Ders listesi alinamadi: ${sErr.message}` as const };
  }

  const { data: privateRows, error: privateErr } = await adminClient
    .from("private_lesson_sessions")
    .select(
      "id, starts_at, location, status, athlete_profile:profiles!private_lesson_sessions_athlete_id_fkey(full_name, email), pkg:private_lesson_packages!private_lesson_sessions_package_id_fkey(package_name)"
    )
    .eq("organization_id", organizationId)
    .eq("coach_id", coachId)
    .neq("status", "cancelled");

  if (privateErr) {
    return { error: `Özel ders listesi alınamadı: ${privateErr.message}` as const };
  }

  const mappedPrivateRows: CoachAdminScheduleRow[] = (privateRows || []).map((row) => {
    const athlete = Array.isArray(row.athlete_profile) ? row.athlete_profile[0] : row.athlete_profile;
    const pkg = Array.isArray(row.pkg) ? row.pkg[0] : row.pkg;
    const athleteName = athlete?.full_name?.trim() || athlete?.email?.trim() || "Sporcu";
    const pkgName = pkg?.package_name?.trim() || "Özel Ders";
    return {
      id: `private-${row.id}`,
      title: `${pkgName} · ${athleteName}`,
      start_time: row.starts_at,
      location: row.location,
    };
  });

  const { data: permissionRow } = await adminClient
    .from("coach_permissions")
    .select(COACH_PERMISSION_KEYS.join(","))
    .eq("coach_id", coachId)
    .maybeSingle();

  return {
    row: base.row,
    scheduleRows: [...((scheduleRows || []) as CoachAdminScheduleRow[]), ...mappedPrivateRows],
    permissions: normalizeCoachPermissions((permissionRow ?? null) as Partial<CoachPermissions> | null),
  };
}

export async function addCoach(formData: FormData) {
  const email = normalizeEmailInput(formData.get("email")?.toString());
  const fullName = formData.get("fullName")?.toString().trim();
  const password = formData.get("password")?.toString();
  const organizationIdRaw = formData.get("organizationId")?.toString().trim() || "";

  if (!email || !fullName || !password || password.length < 6) {
    return { error: "Email, ad soyad ve en az 6 karakter sifre zorunludur." };
  }
  if (!SIMPLE_EMAIL_RE.test(email)) {
    return { error: "Gecerli bir e-posta adresi girin (ornek: koc@gmail.com)." };
  }

  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: authData, error: authError } = await sessionClient.auth.getUser();

    if (authError || !authData.user) {
      return { error: "Gecersiz oturum. Lutfen tekrar giris yapin." };
    }

    let { data: actorProfile, error: profileError } = await sessionClient
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (!actorProfile) {
      const adminClient = createSupabaseAdminClient();
      const byId = await adminClient
        .from("profiles")
        .select("role, organization_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      actorProfile = byId.data ?? null;
      if (!actorProfile) {
        actorProfile = {
          role: extractSessionRole(authData.user),
          organization_id: extractSessionOrganizationId(authData.user),
        };
      }
      profileError = byId.error ?? null;
    }

    if (profileError || !actorProfile) {
      return { error: "Profil dogrulanamadi." };
    }

    const actorRole = getSafeRole(actorProfile.role);
    let targetOrganizationId: string;

    if (actorRole === "super_admin") {
      if (!assertUuid(organizationIdRaw)) {
        return { error: "Super admin koc eklerken organizationId (UUID) zorunludur." };
      }
      targetOrganizationId = organizationIdRaw;
    } else if (actorRole === "admin") {
      if (!actorProfile.organization_id) {
        return { error: "Admin organization_id bilgisi eksik." };
      }
      targetOrganizationId = actorProfile.organization_id;
    } else {
      return { error: "Bu islem sadece organizasyon admini veya super admin tarafindan yapilabilir." };
    }

    const adminClient = createSupabaseAdminClient();

    const { data: orgCheck } = await adminClient.from("organizations").select("id").eq("id", targetOrganizationId).maybeSingle();
    if (!orgCheck) {
      return { error: "Organizasyon bulunamadi." };
    }

    const { data: createdAuth, error: createdAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "coach",
        organization_id: targetOrganizationId,
      },
    });

    if (createdAuthError || !createdAuth.user) {
      const msg = createdAuthError?.message || "";
      const duplicate =
        /already\s+registered|already\s+exists|user\s+already|duplicate/i.test(msg) ||
        msg.toLowerCase().includes("email address has already been registered");

      if (duplicate) {
        const existingId = await findAuthUserIdByEmail(adminClient, email);
        if (!existingId) {
          return { error: msg || "Bu e-posta zaten kayitli; kullanici bulunamadi. Destek ile iletisime gecin." };
        }

        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("id, role, organization_id, email")
          .eq("id", existingId)
          .maybeSingle();

        if (existingProfile) {
          const r = getSafeRole(existingProfile.role);
          if (r === "coach" && existingProfile.organization_id === targetOrganizationId) {
            const permErr = await ensureCoachPermissionsRow(adminClient, existingId, targetOrganizationId);
            if (permErr) {
              return { error: `Koc izinleri guncellenemedi: ${permErr.message}` };
            }
            revalidatePath("/");
            revalidatePath("/koclar");
            revalidatePath("/super-admin");
            revalidatePath(`/super-admin/${targetOrganizationId}`);
            return { success: true as const, alreadyExisted: true as const };
          }
          return {
            error: `Bu e-posta baska bir rol veya organizasyonla kayitli (${r}). Ayni e-posta ile ikinci koc olusturulamaz.`,
          };
        }

        const { error: insertProfErr } = await adminClient.from("profiles").insert({
          id: existingId,
          full_name: fullName,
          email,
          role: "coach",
          organization_id: targetOrganizationId,
          is_active: true,
          created_at: new Date().toISOString(),
        });

        if (insertProfErr) {
          return { error: `Profil tamamlanamadi (auth kullanicisi var): ${insertProfErr.message}` };
        }

        const permErr = await ensureCoachPermissionsRow(adminClient, existingId, targetOrganizationId);
        if (permErr) {
          await adminClient.from("profiles").delete().eq("id", existingId);
          return { error: `Koc izinleri olusturulamadi: ${permErr.message}` };
        }

        revalidatePath("/");
        revalidatePath("/koclar");
        revalidatePath("/super-admin");
        revalidatePath(`/super-admin/${targetOrganizationId}`);
        return { success: true as const, repairedOrphan: true as const };
      }

      return { error: msg || "Coach auth hesabi olusturulamadi." };
    }

    const userId = createdAuth.user.id;

    const { error: profileInsertError } = await adminClient.from("profiles").insert({
      id: userId,
      full_name: fullName,
      email,
      role: "coach",
      organization_id: targetOrganizationId,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (profileInsertError) {
      await adminClient.auth.admin.deleteUser(userId);
      return { error: `Coach profil olusturulamadi: ${profileInsertError.message}` };
    }

    const permErr = await ensureCoachPermissionsRow(adminClient, userId, targetOrganizationId);
    if (permErr) {
      await adminClient.from("profiles").delete().eq("id", userId);
      await adminClient.auth.admin.deleteUser(userId);
      return { error: `Koc izinleri olusturulamadi: ${permErr.message}` };
    }

    revalidatePath("/");
    revalidatePath("/koclar");
    revalidatePath("/super-admin");
    revalidatePath(`/super-admin/${targetOrganizationId}`);
    return { success: true as const };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Beklenmedik bir hata olustu.";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return {
        error:
          "Kurulum eksik: .env.local icine SUPABASE_SERVICE_ROLE_KEY ekleyin ve dev server'i yeniden baslatin.",
      };
    }
    return { error: message };
  }
}
