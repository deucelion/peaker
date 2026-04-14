"use server";

import { createSupabaseAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { normalizeEmailInput, SIMPLE_EMAIL_RE } from "@/lib/email/emailNormalize";

export async function addPlayer(formData: FormData) {
  // 1. VERİLERİ TEMİZLE VE AL
  const email = normalizeEmailInput(formData.get("email")?.toString());
  const fullName = formData.get("fullName")?.toString().trim();
  const password = formData.get("password")?.toString();
  const position = formData.get("position")?.toString();
  const team = formData.get("team")?.toString().trim() || null;

  // 2. SIKI DOĞRULAMA
  if (!email || !SIMPLE_EMAIL_RE.test(email) || !password || password.length < 6) {
    return { error: "Geçerli bir e-posta ve en az 6 karakterli şifre zorunludur." };
  }

  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    if (userError || !userData.user) {
      return { error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." };
    }

    const { data: actorProfile, error: actorError } = await sessionClient
      .from("profiles")
      .select("role, organization_id, is_active")
      .eq("id", userData.user.id)
      .single();

    if (actorError || !actorProfile?.organization_id) {
      return { error: "Kullanıcı profil doğrulaması başarısız." };
    }

    const actorRole = getSafeRole(actorProfile.role);
    if (actorRole !== "admin" && actorRole !== "coach") {
      return { error: "Bu işlem için yetkiniz bulunmuyor." };
    }
    const coachBlock = messageIfCoachCannotOperate(actorProfile.role, actorProfile.is_active);
    if (coachBlock) return { error: coachBlock };

    const organizationId = actorProfile.organization_id;
    const adminClient = createSupabaseAdminClient();

    // 3. ADIM: AUTH SİSTEMİNE KAYIT
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "sporcu",
        organization_id: organizationId,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Kullanıcı oluşturulamadı.");

    // 4. ADIM: PROFILES TABLOSUNA İZOLASYONLU KAYIT
    const { error: dbError } = await adminClient
      .from("profiles") 
      .insert([
        { 
          id: authData.user.id, 
          full_name: fullName, 
          email: email,
          role: "sporcu",
          position: position || "Belirtilmedi",
          team,
          organization_id: organizationId, // Bu satır güvenliğin temelidir
          is_active: true,
          created_at: new Date().toISOString()
        }
      ]);

    if (dbError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      console.error("Database Hatası:", dbError.message);
      return { error: `Profil oluşturulamadı: ${dbError.message}` };
    }

    // 5. ADIM: CACHE TEMİZLEME
    revalidatePath("/oyuncular");
    revalidatePath("/dashboard");
    
    return { success: true };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Beklenmedik bir hata oluştu.";
    console.error("Sistem Hatası:", message);
    return { error: message };
  }
}

async function assertCanMutateAthleteLifecycle(playerId: string) {
  if (!playerId) {
    return { error: "Sporcu kimligi bos olamaz." as const };
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: userData, error: userError } = await sessionClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Oturum dogrulanamadi. Lutfen tekrar giris yapin." as const };
  }

  const { data: actorProfile, error: actorError } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", userData.user.id)
    .single();

  if (actorError || !actorProfile?.organization_id) {
    return { error: "Kullanici profil dogrulamasi basarisiz." as const };
  }

  const actorRole = getSafeRole(actorProfile.role);
  if (actorRole !== "admin" && actorRole !== "coach") {
    return { error: "Bu islem icin yetkiniz bulunmuyor." as const };
  }
  const coachBlock = messageIfCoachCannotOperate(actorProfile.role, actorProfile.is_active);
  if (coachBlock) return { error: coachBlock };

  const adminClient = createSupabaseAdminClient();
  const { data: targetProfile, error: targetError } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", playerId)
    .maybeSingle();

  if (targetError || !targetProfile) {
    return { error: "Sporcu bulunamadi." as const };
  }

  if (getSafeRole(targetProfile.role) !== "sporcu") {
    return { error: "Yalnizca sporcu profilleri bu islemle guncellenebilir." as const };
  }

  if (targetProfile.organization_id !== actorProfile.organization_id) {
    return { error: "Baska organizasyondaki sporcu uzerinde islem yapilamaz." as const };
  }

  return { actorProfile, adminClient, targetProfile };
}

/** Auth kullanicisini silmez; profil `is_active: false` — gecmis veri korunur, panel erisimi kesilir. */
export async function deactivateAthlete(playerId: string) {
  try {
    const gate = await assertCanMutateAthleteLifecycle(playerId);
    if ("error" in gate) return { error: gate.error };

    const { adminClient, actorProfile } = gate;
    const { error: updErr } = await adminClient
      .from("profiles")
      .update({ is_active: false })
      .eq("id", playerId);

    if (updErr) {
      return { error: `Profil guncellenemedi: ${updErr.message}` };
    }

    await logAuditEvent({
      organizationId: actorProfile.organization_id,
      actorUserId: actorProfile.id,
      actorRole: actorProfile.role,
      action: "athlete.lifecycle.update",
      entityType: "athlete",
      entityId: playerId,
      metadata: { active: false },
    });

    revalidatePath("/oyuncular");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Beklenmedik bir hata oluştu.";
    return { error: message };
  }
}

export async function reactivateAthlete(playerId: string) {
  try {
    const gate = await assertCanMutateAthleteLifecycle(playerId);
    if ("error" in gate) return { error: gate.error };

    const { adminClient, actorProfile } = gate;
    const { error: updErr } = await adminClient
      .from("profiles")
      .update({ is_active: true })
      .eq("id", playerId);

    if (updErr) {
      return { error: `Profil guncellenemedi: ${updErr.message}` };
    }

    await logAuditEvent({
      organizationId: actorProfile.organization_id,
      actorUserId: actorProfile.id,
      actorRole: actorProfile.role,
      action: "athlete.lifecycle.update",
      entityType: "athlete",
      entityId: playerId,
      metadata: { active: true },
    });

    revalidatePath("/oyuncular");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Beklenmedik bir hata oluştu.";
    return { error: message };
  }
}