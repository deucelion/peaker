"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { normalizeEmailInput, SIMPLE_EMAIL_RE } from "@/lib/email/emailNormalize";
import { extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { captureServerActionSignal } from "@/lib/observability/serverActionError";

type OnboardingMode = "none" | "private_lesson" | "monthly_subscription";

function asDate(value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  if (Number.isNaN(new Date(`${v}T00:00:00`).getTime())) return null;
  return v;
}

async function resolveActorProfileWithFallback(userId: string) {
  const sessionClient = await createServerSupabaseClient();
  const { data: actorProfile, error: actorError } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (actorProfile) return { actorProfile, actorError: null };

  const adminClient = createSupabaseAdminClient();
  const byId = await adminClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (byId.data) return { actorProfile: byId.data, actorError: null };

  const { data: authData } = await sessionClient.auth.getUser();
  const user = authData.user;
  if (user) {
    const claimRole = extractSessionRole(user);
    const claimOrg = extractSessionOrganizationId(user);
    if (claimRole && claimOrg) {
      return {
        actorProfile: {
          id: user.id,
          role: claimRole,
          organization_id: claimOrg,
          is_active: true,
        },
        actorError: null,
      };
    }
  }
  return { actorProfile: null, actorError: actorError || byId.error || null };
}

export async function createAthleteWithPackageAndPayment(formData: FormData) {
  const schemaError = await assertCriticalSchemaReady([
    "private_lesson_packages_ready",
    "private_lesson_payments_ready",
    "production_hardening_atomicity_ready",
  ]);
  if (schemaError) return { error: schemaError };

  const sessionClient = await createServerSupabaseClient();
  const { data: userData, error: userError } = await sessionClient.auth.getUser();
  if (userError || !userData.user) return { error: "Oturum doğrulanamadı." };

  const { actorProfile, actorError } = await resolveActorProfileWithFallback(userData.user.id);
  if (actorError || !actorProfile?.organization_id) return { error: "Kullanıcı profil doğrulaması başarısız." };

  const actorRole = getSafeRole(actorProfile.role);
  if (actorRole !== "admin" && actorRole !== "coach") return { error: "Bu işlem için yetkiniz bulunmuyor." };
  const coachBlock = messageIfCoachCannotOperate(actorProfile.role, actorProfile.is_active);
  if (coachBlock) return { error: coachBlock };
  if (actorRole === "coach") {
    const permissions = await getCoachPermissions(actorProfile.id, actorProfile.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_athlete_profiles")) {
      return { error: "Sporcu onboarding yetkiniz yok." };
    }
  }

  const fullName = formData.get("fullName")?.toString().trim() || "";
  const email = normalizeEmailInput(formData.get("email")?.toString());
  const password = formData.get("password")?.toString().trim() || "";
  const phone = formData.get("phone")?.toString().trim() || null;
  const teamId = formData.get("teamId")?.toString().trim() || "";
  const position = formData.get("position")?.toString().trim() || null;
  const height = formData.get("height")?.toString().trim() || "";
  const weight = formData.get("weight")?.toString().trim() || "";
  const onboardingMode = (formData.get("onboardingMode")?.toString().trim() || "none") as OnboardingMode;
  const packageCoachId = formData.get("coachId")?.toString().trim() || null;

  if (!fullName) return { error: "Ad soyad zorunludur." };
  if (!email || !SIMPLE_EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta girin." };
  if (!password || password.length < 6) return { error: "Şifre en az 6 karakter olmalıdır." };
  if (!["none", "private_lesson", "monthly_subscription"].includes(onboardingMode)) {
    return { error: "Geçersiz onboarding tipi." };
  }

  const totalLessons = Math.floor(Number(formData.get("totalLessons")?.toString() || "0"));
  const packageTotalPrice = normalizeMoney(formData.get("packageTotalPrice")?.toString() || "0");
  const packageStartDate = asDate(formData.get("packageStartDate")?.toString());
  const monthlyAmount = normalizeMoney(formData.get("monthlyAmount")?.toString() || "0");
  const monthlyStartDate = asDate(formData.get("monthlyStartDate")?.toString());

  const paymentTotal = normalizeMoney(formData.get("paymentTotal")?.toString() || "0");
  const paymentPaid = normalizeMoney(formData.get("paymentPaid")?.toString() || "0");
  const paymentDate = asDate(formData.get("paymentDate")?.toString()) || new Date().toISOString().slice(0, 10);

  if (paymentPaid < 0 || paymentTotal < 0 || paymentPaid > paymentTotal) {
    return { error: "Ödeme alanları geçersiz." };
  }

  if (onboardingMode === "private_lesson") {
    if (!Number.isFinite(totalLessons) || totalLessons <= 0) return { error: "Toplam ders sayısı zorunludur." };
    if (packageTotalPrice <= 0) return { error: "Toplam ücret sıfırdan büyük olmalıdır." };
    if (!packageStartDate) return { error: "Özel ders başlangıç tarihi zorunludur." };
  }

  if (onboardingMode === "monthly_subscription") {
    if (monthlyAmount <= 0) return { error: "Aylık ücret sıfırdan büyük olmalıdır." };
    if (!monthlyStartDate) return { error: "Aylık başlangıç tarihi zorunludur." };
  }

  const adminClient = createSupabaseAdminClient();
  let createdAuthUserId: string | null = null;
  try {
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "sporcu",
        organization_id: actorProfile.organization_id,
        onboarding_flow: "athlete_onboarding",
        onboarding_status: "pending",
        onboarding_actor_id: actorProfile.id,
        onboarding_started_at: new Date().toISOString(),
      },
    });
    if (authErr || !authData.user) return { error: authErr?.message || "Sporcu auth hesabı oluşturulamadı." };
    createdAuthUserId = authData.user.id;

    let coachId: string | null = packageCoachId;
    if (onboardingMode === "private_lesson") {
      if (actorRole === "coach" && !coachId) coachId = actorProfile.id;
      if (coachId) {
        const { data: coach } = await adminClient
          .from("profiles")
          .select("id, role")
          .eq("id", coachId)
          .eq("organization_id", actorProfile.organization_id)
          .maybeSingle();
        if (!coach || getSafeRole(coach.role) !== "coach") {
          await adminClient.auth.admin.deleteUser(authData.user.id);
          return { error: "Seçilen koç geçersiz." };
        }
      }
    }

    let team: string | null = null;
    if (teamId) {
      const { data: teamRow, error: teamErr } = await adminClient
        .from("teams")
        .select("id, name, organization_id")
        .eq("id", teamId)
        .eq("organization_id", actorProfile.organization_id)
        .maybeSingle();
      if (teamErr || !teamRow) {
        await adminClient.auth.admin.deleteUser(authData.user.id);
        return { error: "Seçilen takım bulunamadı." };
      }
      team = (teamRow.name || "").trim() || null;
    }

    const parsedHeight = height ? Number(height) : null;
    const parsedWeight = weight ? Number(weight) : null;
    const positionValue = position || null;
    const { data: bundleResult, error: bundleErr } = await adminClient.rpc("create_athlete_onboarding_bundle", {
      p_user_id: authData.user.id,
      p_organization_id: actorProfile.organization_id,
      p_actor_id: actorProfile.id,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_team: team,
      p_position: positionValue,
      p_height: Number.isFinite(parsedHeight) ? parsedHeight : null,
      p_weight: Number.isFinite(parsedWeight) ? parsedWeight : null,
      p_onboarding_mode: onboardingMode,
      p_total_lessons: onboardingMode === "private_lesson" ? totalLessons : 0,
      p_package_total_price: onboardingMode === "private_lesson" ? packageTotalPrice : 0,
      p_payment_paid: paymentPaid,
      p_payment_date: `${paymentDate}T09:00:00.000Z`,
      p_monthly_amount: onboardingMode === "monthly_subscription" ? monthlyAmount : 0,
      p_monthly_start_date: onboardingMode === "monthly_subscription" ? monthlyStartDate : null,
      p_package_coach_id: coachId,
    });
    if (bundleErr) {
      captureServerActionSignal("athleteOnboarding.createAthleteWithPackageAndPayment", "bundle_rpc_failed", {
        organizationId: actorProfile.organization_id,
        actorId: actorProfile.id,
        athleteAuthUserId: authData.user.id,
        onboardingMode,
        errorMessage: bundleErr.message,
      });
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return { error: `Sporcu kaydı atomik işlemde tamamlanamadı: ${bundleErr.message}` };
    }

    const { error: metadataErr } = await adminClient.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        full_name: fullName,
        role: "sporcu",
        organization_id: actorProfile.organization_id,
        onboarding_flow: "athlete_onboarding",
        onboarding_status: "completed",
        onboarding_actor_id: actorProfile.id,
        onboarding_completed_at: new Date().toISOString(),
      },
    });
    if (metadataErr) {
      captureServerActionSignal("athleteOnboarding.createAthleteWithPackageAndPayment", "onboarding_metadata_finalize_failed", {
        organizationId: actorProfile.organization_id,
        actorId: actorProfile.id,
        athleteAuthUserId: authData.user.id,
        errorMessage: metadataErr.message,
      });
    }

    const packageId =
      Array.isArray(bundleResult) && bundleResult.length > 0
        ? ((bundleResult[0] as { package_id?: string | null }).package_id ?? null)
        : null;

    revalidatePath("/oyuncular");
    revalidatePath("/sporcu");
    revalidatePath("/finans");
    revalidatePath("/ozel-ders-paketleri");
    return { success: true as const, athleteId: authData.user.id, packageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Onboarding sırasında beklenmedik hata.";
    captureServerActionSignal("athleteOnboarding.createAthleteWithPackageAndPayment", "unexpected_exception", {
      actorId: actorProfile.id,
      organizationId: actorProfile.organization_id,
      createdAuthUserId,
      message,
    });
    if (createdAuthUserId) {
      const { error: profileDeleteErr } = await adminClient.from("profiles").delete().eq("id", createdAuthUserId);
      if (profileDeleteErr) {
        captureServerActionSignal("athleteOnboarding.createAthleteWithPackageAndPayment", "profile_rollback_delete_failed", {
          createdAuthUserId,
          errorMessage: profileDeleteErr.message,
        });
      }
      const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(createdAuthUserId);
      if (authDeleteErr) {
        captureServerActionSignal("athleteOnboarding.createAthleteWithPackageAndPayment", "auth_rollback_delete_failed", {
          createdAuthUserId,
          errorMessage: authDeleteErr.message,
        });
      }
    }
    return { error: message };
  }
}

export async function inspectAthleteOnboardingAuthIntegrity(options?: { staleMinutes?: number; limit?: number }) {
  const sessionClient = await createServerSupabaseClient();
  const { data: userData, error: userError } = await sessionClient.auth.getUser();
  if (userError || !userData.user) return { error: "Oturum doğrulanamadı." };
  const { actorProfile, actorError } = await resolveActorProfileWithFallback(userData.user.id);
  if (actorError || !actorProfile) return { error: "Kullanıcı profil doğrulaması başarısız." };

  const actorRole = getSafeRole(actorProfile.role);
  if (actorRole !== "admin" && actorRole !== "super_admin") return { error: "Bu işlem için yetkiniz bulunmuyor." };

  const staleMinutes = Math.max(10, Math.min(60 * 24 * 30, Number(options?.staleMinutes || 90)));
  const limit = Math.max(1, Math.min(200, Number(options?.limit || 50)));
  const staleThreshold = Date.now() - staleMinutes * 60 * 1000;
  const adminClient = createSupabaseAdminClient();

  const authUsers: Array<{
    id: string;
    email: string | null;
    created_at: string | null;
    user_metadata?: { onboarding_flow?: string; onboarding_status?: string; organization_id?: string } | null;
  }> = [];
  for (let page = 1; page <= 30 && authUsers.length < limit * 4; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { error: `Auth kullanıcı listesi alınamadı: ${error.message}` };
    const batch = data?.users ?? [];
    authUsers.push(
      ...batch.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: (u as { created_at?: string | null }).created_at ?? null,
        user_metadata: (u.user_metadata as { onboarding_flow?: string; onboarding_status?: string; organization_id?: string } | null) ?? null,
      }))
    );
    if (batch.length < 200) break;
  }

  const targetUsers = authUsers.filter((u) => {
    if (u.user_metadata?.onboarding_flow !== "athlete_onboarding") return false;
    if (u.user_metadata?.onboarding_status === "completed") return false;
    if (actorRole === "admin" && u.user_metadata?.organization_id !== actorProfile.organization_id) return false;
    const createdAt = u.created_at ? new Date(u.created_at).getTime() : 0;
    return createdAt > 0 && createdAt <= staleThreshold;
  });
  if (targetUsers.length === 0) {
    return { success: true as const, staleMinutes, count: 0, candidates: [] as Array<{ userId: string; email: string | null; createdAt: string | null }> };
  }

  const userIds = targetUsers.map((u) => u.id);
  const { data: profiles, error: profilesErr } = await adminClient.from("profiles").select("id").in("id", userIds);
  if (profilesErr) return { error: `Profile listesi alınamadı: ${profilesErr.message}` };
  const profileSet = new Set((profiles || []).map((p) => p.id));

  const candidates = targetUsers
    .filter((u) => !profileSet.has(u.id))
    .slice(0, limit)
    .map((u) => ({
      userId: u.id,
      email: u.email,
      createdAt: u.created_at,
    }));

  return { success: true as const, staleMinutes, count: candidates.length, candidates };
}

export async function cleanupStaleAthleteOnboardingAuthUsers(input: {
  confirmation: string;
  staleMinutes?: number;
  limit?: number;
}) {
  if (input.confirmation !== "DELETE_STALE_ONBOARDING_USERS") {
    return { error: "Onay metni geçersiz. Güvenlik için işlem durduruldu." };
  }
  const scanned = await inspectAthleteOnboardingAuthIntegrity({
    staleMinutes: input.staleMinutes,
    limit: input.limit,
  });
  if (!("success" in scanned) || !scanned.success) return scanned;
  if (!scanned.candidates.length) return { success: true as const, deleted: 0, failed: 0 };

  const adminClient = createSupabaseAdminClient();
  let deleted = 0;
  let failed = 0;
  for (const candidate of scanned.candidates) {
    const { error } = await adminClient.auth.admin.deleteUser(candidate.userId);
    if (error) {
      failed += 1;
      captureServerActionSignal("athleteOnboarding.cleanupStaleAthleteOnboardingAuthUsers", "auth_cleanup_delete_failed", {
        userId: candidate.userId,
        errorMessage: error.message,
      });
    } else {
      deleted += 1;
    }
  }
  return { success: true as const, deleted, failed };
}
