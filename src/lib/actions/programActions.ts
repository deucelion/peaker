"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { isInactiveAthleteProfile, messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { isInactiveCoachProfile, messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { resolveSessionActor, toProgramActorProfile, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { toDisplayName } from "@/lib/profile/displayName";

const ATHLETE_PROGRAM_MANAGEMENT_SELECT =
  "id, organization_id, coach_id, athlete_id, title, content, note, week_start, pdf_url, created_at, updated_at, is_read, is_active, coach_profile:profiles!athlete_programs_coach_id_fkey(full_name), athlete_profile:profiles!athlete_programs_athlete_id_fkey(full_name)";

const ATHLETE_PROGRAM_DASHBOARD_ADMIN_SELECT =
  "id, title, created_at, coach_profile:profiles!athlete_programs_coach_id_fkey(full_name), athlete_profile:profiles!athlete_programs_athlete_id_fkey(full_name)";

const ATHLETE_PROGRAM_DASHBOARD_COACH_SELECT =
  "id, title, created_at, is_active, athlete_profile:profiles!athlete_programs_athlete_id_fkey(full_name)";

async function resolveActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toProgramActorProfile(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." as const };
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };
  const athleteBlock = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (athleteBlock) return { error: athleteBlock };
  return { actor };
}

export async function createAthleteProgram(formData: FormData) {
  const schemaError = await assertCriticalSchemaReady([
    "coach_permissions",
    "athlete_programs_lifecycle",
    "notifications_ready",
  ]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };

  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { error: "Antrenor notu/program yonetimi yetkiniz yok." };
    }
  }

  const title = formData.get("title")?.toString().trim() || "";
  const content = formData.get("content")?.toString().trim() || formData.get("note")?.toString().trim() || "";
  const weekStart = formData.get("weekStart")?.toString() || null;
  const attachment = formData.get("attachment");
  const coachIdRaw = formData.get("coachId")?.toString() || "";
  const athleteIds = Array.from(new Set(formData.getAll("athleteIds").map((v) => v.toString()).filter(Boolean)));

  if (!title) return { error: "Baslik zorunludur." };
  if (athleteIds.length === 0) return { error: "En az bir sporcu secmelisiniz." };
  let uploadedFileUrl: string | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    const isAllowedType =
      attachment.type === "application/pdf" || attachment.type.startsWith("image/");
    if (!isAllowedType) return { error: "Sadece PDF veya gorsel dosya yukleyebilirsiniz." };
    if (attachment.size > 10 * 1024 * 1024) return { error: "Dosya boyutu 10MB'dan buyuk olamaz." };
  }

  const orgId = actor.organization_id!;
  const coachId = role === "coach" ? actor.id : coachIdRaw || actor.id;
  const adminClient = createSupabaseAdminClient();

  if (attachment instanceof File && attachment.size > 0) {
    const extension = attachment.name.includes(".")
      ? attachment.name.split(".").pop()?.toLowerCase()
      : undefined;
    const safeExt = extension || (attachment.type === "application/pdf" ? "pdf" : "jpg");
    const filePath = `${orgId}/${coachId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;
    const { error: uploadError } = await adminClient.storage
      .from("program-assets")
      .upload(filePath, attachment, { upsert: false, contentType: attachment.type });
    if (uploadError) return { error: `Dosya yuklenemedi: ${uploadError.message}` };
    const { data: publicData } = adminClient.storage.from("program-assets").getPublicUrl(filePath);
    uploadedFileUrl = publicData.publicUrl;
  }

  const { data: coachProfile } = await adminClient
    .from("profiles")
    .select("id, role, full_name, organization_id, is_active")
    .eq("id", coachId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!coachProfile || getSafeRole(coachProfile.role) !== "coach") return { error: "Gecerli bir koc secilemedi." };
  if (isInactiveCoachProfile(coachProfile.role, coachProfile.is_active)) {
    return { error: "Secilen koc pasif; program atanamaz." };
  }

  const { data: athletes } = await adminClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .in("id", athleteIds);
  const validAthleteIds = (athletes || [])
    .filter(
      (a) =>
        a.organization_id === orgId &&
        getSafeRole(a.role) === "sporcu" &&
        !isInactiveAthleteProfile(a.role, a.is_active)
    )
    .map((a) => a.id);

  if (validAthleteIds.length !== athleteIds.length) {
    return { error: "Secili sporculardan bazilari organizasyon disi, pasif veya gecersiz." };
  }

  const { data: insertedRows, error: insertErr } = await adminClient.from("athlete_programs").insert(
    validAthleteIds.map((athleteId) => ({
      organization_id: orgId,
      coach_id: coachId,
      athlete_id: athleteId,
      title,
      content,
      note: content,
      week_start: weekStart || null,
      pdf_url: uploadedFileUrl,
      is_read: false,
      is_active: true,
      updated_at: new Date().toISOString(),
    }))
  ).select("id");
  if (insertErr) return { error: `Program kaydedilemedi: ${insertErr.message}` };

  await logAuditEvent({
    organizationId: orgId,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "program.create",
    entityType: "program",
    entityId: (insertedRows?.[0]?.id as string) || `${coachId}:${Date.now()}`,
    metadata: { athleteCount: validAthleteIds.length },
  });

  const coachName = toDisplayName(coachProfile.full_name, null, "Koc");
  const dateText = new Date().toLocaleDateString("tr-TR");
  await insertNotificationsForUsers(
    validAthleteIds,
    `${title} programi ${coachName} tarafindan ${dateText} tarihinde eklendi.`
  );

  revalidatePath("/notlar-haftalik-program");
  revalidatePath("/programlarim");
  revalidatePath("/bildirimler");
  return { success: true };
}

export async function markProgramRead(programId: string) {
  const schemaError = await assertCriticalSchemaReady(["athlete_programs_lifecycle"]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const adminClient = createSupabaseAdminClient();
  const { data: program } = await adminClient
    .from("athlete_programs")
    .select("id, athlete_id, organization_id, is_read")
    .eq("id", programId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!program) return { error: "Program bulunamadi." };
  if (getSafeRole(actor.role) === "sporcu" && program.athlete_id !== actor.id) {
    return { error: "Bu programa erisiminiz yok." };
  }

  if (!program.is_read) {
    const { error } = await adminClient
      .from("athlete_programs")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", programId)
      .eq("organization_id", actor.organization_id);
    if (error) return { error: `Program guncellenemedi: ${error.message}` };
  }

  revalidatePath("/programlarim");
  return { success: true };
}

export async function setProgramActive(programId: string, isActive: boolean) {
  const schemaError = await assertCriticalSchemaReady(["athlete_programs_lifecycle", "coach_permissions"]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { error: "Program yonetim yetkiniz yok." };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data: program } = await adminClient
    .from("athlete_programs")
    .select("id, coach_id, organization_id")
    .eq("id", programId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!program) return { error: "Program bulunamadi." };
  if (role === "coach" && program.coach_id !== actor.id) return { error: "Sadece kendi programinizi yonetebilirsiniz." };

  const { error } = await adminClient
    .from("athlete_programs")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", programId)
    .eq("organization_id", actor.organization_id);
  if (error) return { error: `Program durumu guncellenemedi: ${error.message}` };

  revalidatePath("/notlar-haftalik-program");
  revalidatePath("/programlarim");
  return { success: true };
}

export async function updateAthleteProgramContent(formData: FormData) {
  const schemaError = await assertCriticalSchemaReady([
    "coach_permissions",
    "athlete_programs_lifecycle",
  ]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { error: "Antrenor notu/program yonetimi yetkiniz yok." };
    }
  }

  const programId = formData.get("programId")?.toString().trim() || "";
  const title = formData.get("title")?.toString().trim() || "";
  const content = formData.get("content")?.toString().trim() || "";
  const weekStartRaw = formData.get("weekStart")?.toString().trim() || "";

  if (!programId) return { error: "Program kimligi gerekli." };
  if (!title) return { error: "Baslik zorunludur." };

  let weekStart: string | null = null;
  if (weekStartRaw) {
    const d = new Date(`${weekStartRaw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return { error: "Gecersiz hafta tarihi." };
    weekStart = d.toISOString();
  }

  const adminClient = createSupabaseAdminClient();
  const { data: program } = await adminClient
    .from("athlete_programs")
    .select("id, coach_id, organization_id")
    .eq("id", programId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!program) return { error: "Program bulunamadi." };
  if (role === "coach" && program.coach_id !== actor.id) {
    return { error: "Sadece kendi programinizi duzenleyebilirsiniz." };
  }

  const { error } = await adminClient
    .from("athlete_programs")
    .update({
      title,
      content,
      note: content,
      week_start: weekStart,
      updated_at: new Date().toISOString(),
    })
    .eq("id", programId)
    .eq("organization_id", actor.organization_id);
  if (error) return { error: `Program guncellenemedi: ${error.message}` };

  await logAuditEvent({
    organizationId: actor.organization_id,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "program.update",
    entityType: "program",
    entityId: programId,
  });

  revalidatePath("/notlar-haftalik-program");
  revalidatePath("/programlarim");
  return { success: true };
}

export async function listRecentAthleteProgramsForDashboard(): Promise<
  { programs: unknown[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["athlete_programs_lifecycle"]);
  if (schemaError) return { error: schemaError };

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return { error: "Gecersiz oturum." };

  const { data: actor } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!actor?.organization_id) return { error: "Organizasyon bilgisi eksik." };
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };
  const athleteBlock = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (athleteBlock) return { error: athleteBlock };

  const role = getSafeRole(actor.role);
  const adminClient = createSupabaseAdminClient();

  if (role === "admin") {
    const { data, error } = await adminClient
      .from("athlete_programs")
      .select(ATHLETE_PROGRAM_DASHBOARD_ADMIN_SELECT)
      .eq("organization_id", actor.organization_id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return { error: `Programlar alinamadi: ${error.message}` };
    return { programs: data ?? [] };
  }

  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { programs: [] };
    }
    const { data, error } = await adminClient
      .from("athlete_programs")
      .select(ATHLETE_PROGRAM_DASHBOARD_COACH_SELECT)
      .eq("organization_id", actor.organization_id)
      .eq("coach_id", actor.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return { error: `Programlar alinamadi: ${error.message}` };
    return { programs: data ?? [] };
  }

  return { programs: [] };
}

export async function listAthleteProgramsForManagementUI(): Promise<
  { programs: unknown[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady([
    "athlete_programs_lifecycle",
    "coach_permissions",
  ]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error ?? "Profil dogrulanamadi." };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu sayfa yalnizca yonetici veya antrenor icindir." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { error: "Antrenor notu/program yonetimi yetkiniz yok." };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("athlete_programs")
    .select(ATHLETE_PROGRAM_MANAGEMENT_SELECT)
    .eq("organization_id", actor.organization_id!)
    .order("created_at", { ascending: false });
  if (error) return { error: `Programlar alinamadi: ${error.message}` };
  return { programs: data ?? [] };
}

export async function listAthleteProgramsForAthleteView(): Promise<
  { programs: unknown[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady([
    "athlete_programs_lifecycle",
    "athlete_permissions",
  ]);
  if (schemaError) return { error: schemaError };

  const sessionClient = await createServerSupabaseClient();
  const resolvedActor = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolvedActor) return { error: resolvedActor.error };
  const actor = toTenantProfileRow(resolvedActor.actor);

  if (getSafeRole(actor.role) !== "sporcu") {
    return { error: "Bu islem yalnizca sporcular icindir." };
  }
  const athleteBlock = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (athleteBlock) return { error: athleteBlock };
  if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };

  const { data: permissionRow } = await sessionClient
    .from("athlete_permissions")
    .select("can_view_programs")
    .eq("athlete_id", actor.id)
    .maybeSingle();
  if ((permissionRow?.can_view_programs ?? true) === false) {
    return { error: "Programlar bolumu sizin icin kapali." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("athlete_programs")
    .select(ATHLETE_PROGRAM_MANAGEMENT_SELECT)
    .eq("athlete_id", actor.id)
    .eq("organization_id", actor.organization_id)
    .order("created_at", { ascending: false });
  if (error) return { error: `Programlar alinamadi: ${error.message}` };
  return { programs: data ?? [] };
}
