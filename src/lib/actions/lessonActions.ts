"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { isInactiveAthleteProfile, messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { isInactiveCoachProfile, messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { hasTimeOverlap, mapLesson } from "@/lib/mappers";
import { parseLessonFormInstantToUtcIso } from "@/lib/schedule/scheduleWallTime";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { DEFAULT_COACH_PERMISSIONS, type CoachPermissions } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import type { Lesson } from "@/lib/types/lesson";

type ActorProfile = {
  id: string;
  role: string;
  organization_id: string | null;
  is_active: boolean | null;
};

type ExistingLesson = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
};

type ParticipantWithSchedule = {
  profile_id: string;
  training_schedule:
    | {
        id?: string;
        start_time: string;
        end_time: string;
        status: string;
        organization_id: string;
      }
    | {
        id?: string;
        start_time: string;
        end_time: string;
        status: string;
        organization_id: string;
      }[]
    | null;
};

function formatLessonWhenTr(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const day = start.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const from = start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const to = end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${from}-${to}`;
}

function buildLessonCancelledNotificationMessage(title: string, startTime: string, endTime: string) {
  return `${title} · ${formatLessonWhenTr(startTime, endTime)} dersiniz iptal edilmiştir.`;
}

function coachMayCoordinateOrgLesson(permissions: CoachPermissions, lessonCoachId: string | null | undefined, actorId: string) {
  if (!lessonCoachId || lessonCoachId === actorId) return true;
  return Boolean(permissions.can_view_all_organization_lessons);
}

async function resolveActor(): Promise<{ actor: ActorProfile } | { error: string }> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." };
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };
  const athleteBlock = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (athleteBlock) return { error: athleteBlock };
  return { actor: actor as ActorProfile };
}

export async function createLesson(formData: FormData) {
  const schemaError = await assertCriticalSchemaReady(["coach_permissions", "notifications_ready"]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: "Bu islem icin yetkiniz yok." };
  }
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_create_lessons")) {
      return { error: "Ders olusturma yetkiniz yok." };
    }
  }

  const title = formData.get("title")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim() || "";
  const startTimeRaw = formData.get("startTime")?.toString() || "";
  const endTimeRaw = formData.get("endTime")?.toString() || "";
  const startTime = parseLessonFormInstantToUtcIso(startTimeRaw);
  const endTime = parseLessonFormInstantToUtcIso(endTimeRaw);
  const capacity = Number(formData.get("capacity")?.toString() || "20");
  const coachIdRaw = formData.get("coachId")?.toString() || "";
  const selectedAthletesRaw = formData.getAll("athleteIds").map((v) => v.toString());

  if (!title || !location || !startTime || !endTime) return { error: "Baslik, lokasyon, baslangic ve bitis zorunludur." };
  if (Number.isNaN(capacity) || capacity <= 0) return { error: "Kapasite pozitif olmalidir." };
  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) return { error: "Bitis saati baslangictan sonra olmalidir." };

  const orgId = actor.organization_id!;
  const coachId = role === "coach" ? actor.id : coachIdRaw || actor.id;

  const adminClient = createSupabaseAdminClient();
  const { data: coachProfile, error: coachErr } = await adminClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", coachId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (coachErr || !coachProfile || getSafeRole(coachProfile.role) !== "coach") {
    return { error: "Gecerli bir koc secilemedi." };
  }
  if (isInactiveCoachProfile(coachProfile.role, coachProfile.is_active)) {
    return { error: "Secilen koc hesabi pasif; ders atanamaz." };
  }

  const { data: coachLessons } = await adminClient
    .from("training_schedule")
    .select("id, start_time, end_time, status")
    .eq("organization_id", orgId)
    .eq("coach_id", coachId)
    .neq("status", "cancelled");

  const coachHasConflict = (coachLessons as ExistingLesson[] | null)?.some((lesson) =>
    hasTimeOverlap(startTime, endTime, lesson.start_time, lesson.end_time)
  );
  if (coachHasConflict) return { error: "Koc bu saat araliginda baska bir derste." };

  const athleteIds = Array.from(new Set(selectedAthletesRaw.filter(Boolean)));
  if (athleteIds.length > capacity) return { error: "Katilimci sayisi kapasiteyi asamaz." };

  if (athleteIds.length > 0) {
    const { data: athleteRows } = await adminClient
      .from("profiles")
      .select("id, role, organization_id, is_active")
      .in("id", athleteIds);
    const validAthleteIds = (athleteRows || [])
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

    const { data: athleteLessons } = await adminClient
      .from("training_participants")
      .select("profile_id, training_schedule!inner(start_time, end_time, status, organization_id)")
      .in("profile_id", athleteIds)
      .eq("training_schedule.organization_id", orgId)
      .neq("training_schedule.status", "cancelled");

    const hasAthleteConflict = ((athleteLessons || []) as ParticipantWithSchedule[]).some((row) => {
      const schedule = Array.isArray(row.training_schedule) ? row.training_schedule[0] : row.training_schedule;
      if (!schedule) return false;
      return hasTimeOverlap(startTime, endTime, schedule.start_time, schedule.end_time);
    });
    if (hasAthleteConflict) return { error: "Secili sporculardan en az biri ayni saatte baska bir derste." };
  }

  const { data: lessonRow, error: insertErr } = await adminClient
    .from("training_schedule")
    .insert({
      title,
      description,
      location,
      start_time: startTime,
      end_time: endTime,
      capacity,
      status: "scheduled",
      coach_id: coachId,
      created_by: actor.id,
      organization_id: orgId,
    })
    .select("id")
    .single();

  if (insertErr || !lessonRow) return { error: `Ders olusturulamadi: ${insertErr?.message || "unknown"}` };

  if (athleteIds.length > 0) {
    const { error: participantErr } = await adminClient.from("training_participants").insert(
      athleteIds.map((id) => ({
        training_id: lessonRow.id,
        profile_id: id,
      }))
    );
    if (participantErr) {
      return { error: `Katilimcilar eklenemedi: ${participantErr.message}` };
    }
  }

  await insertNotificationsForUsers([coachId], `${title} dersi olusturuldu.`);
  if (athleteIds.length > 0) {
    await insertNotificationsForUsers(athleteIds, `${title} dersine eklendiniz.`);
  }
  await logAuditEvent({
    actorUserId: actor.id,
    actorRole: actor.role,
    organizationId: orgId,
    action: "lesson.create",
    entityType: "lesson",
    entityId: lessonRow.id,
  });

  revalidatePath("/dersler");
  revalidatePath(`/dersler/${lessonRow.id}`);
  revalidatePath("/bildirimler");
  return { success: true, lessonId: lessonRow.id };
}

export async function addLessonParticipants(lessonId: string, participantIds: string[]) {
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  let coordPermissions: CoachPermissions | null = null;
  if (role === "coach") {
    coordPermissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(coordPermissions, "can_add_athletes_to_lessons")) {
      return { error: "Derse sporcu ekleme yetkiniz yok." };
    }
  }

  const orgId = actor.organization_id!;
  const adminClient = createSupabaseAdminClient();

  const { data: lesson } = await adminClient
    .from("training_schedule")
    .select("id, title, coach_id, start_time, end_time, capacity, organization_id, status")
    .eq("id", lessonId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!lesson) return { error: "Ders bulunamadi." };
  if (role === "coach" && !coachMayCoordinateOrgLesson(coordPermissions!, lesson.coach_id, actor.id)) {
    return { error: "Sadece kendi dersinizi duzenleyebilirsiniz." };
  }
  if (lesson.status === "cancelled") return { error: "Iptal edilmis derse sporcu eklenemez." };

  const uniqueAthletes = Array.from(new Set(participantIds.filter(Boolean)));
  if (uniqueAthletes.length === 0) return { error: "Eklenecek sporcu secilmedi." };

  const { data: existingParticipants } = await adminClient
    .from("training_participants")
    .select("profile_id")
    .eq("training_id", lessonId);

  const existingIds = new Set((existingParticipants || []).map((p) => p.profile_id));
  const newIds = uniqueAthletes.filter((id) => !existingIds.has(id));

  if ((existingIds.size + newIds.length) > (lesson.capacity || 20)) {
    return { error: "Kapasite asimi." };
  }

  const { data: athleteLessons } = await adminClient
    .from("training_participants")
    .select("profile_id, training_schedule!inner(start_time, end_time, status, organization_id)")
    .in("profile_id", newIds)
    .eq("training_schedule.organization_id", orgId)
    .neq("training_schedule.status", "cancelled");

  const hasConflict = ((athleteLessons || []) as ParticipantWithSchedule[]).some((row) => {
    const schedule = Array.isArray(row.training_schedule) ? row.training_schedule[0] : row.training_schedule;
    if (!schedule) return false;
    return hasTimeOverlap(lesson.start_time, lesson.end_time, schedule.start_time, schedule.end_time);
  });
  if (hasConflict) return { error: "Secili sporculardan bazilari saat cakismasi yasiyor." };

  const { data: newAthleteProfiles } = await adminClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .in("id", newIds);
  const allowedNewIds = (newAthleteProfiles || [])
    .filter(
      (a) =>
        a.organization_id === orgId &&
        getSafeRole(a.role) === "sporcu" &&
        !isInactiveAthleteProfile(a.role, a.is_active)
    )
    .map((a) => a.id);
  if (allowedNewIds.length !== newIds.length) {
    return { error: "Pasif veya gecersiz sporcu derse eklenemez." };
  }

  if (newIds.length > 0) {
    const { error } = await adminClient.from("training_participants").insert(
      newIds.map((id) => ({
        training_id: lessonId,
        profile_id: id,
      }))
    );
    if (error) return { error: `Sporcu ekleme hatasi: ${error.message}` };

    await insertNotificationsForUsers(newIds, `${lesson.title || "Ders"} dersine eklendiniz.`);
    await logAuditEvent({
      actorUserId: actor.id,
      actorRole: actor.role,
      organizationId: orgId,
      action: "lesson.participant.add",
      entityType: "training_participant",
      entityId: lessonId,
    });
  }

  revalidatePath(`/dersler/${lessonId}`);
  revalidatePath("/bildirimler");
  return { success: true };
}

export async function removeLessonParticipant(lessonId: string, participantId: string) {
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  let removeCoordPermissions: CoachPermissions | null = null;
  if (role === "coach") {
    removeCoordPermissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(removeCoordPermissions, "can_add_athletes_to_lessons")) {
      return { error: "Ders katilimci yonetimi yetkiniz yok." };
    }
  }

  const orgId = actor.organization_id!;
  const adminClient = createSupabaseAdminClient();
  const { data: lesson } = await adminClient
    .from("training_schedule")
    .select("id, coach_id, organization_id")
    .eq("id", lessonId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!lesson) return { error: "Ders bulunamadi." };
  if (role === "coach" && !coachMayCoordinateOrgLesson(removeCoordPermissions!, lesson.coach_id, actor.id)) {
    return { error: "Sadece kendi dersinizi duzenleyebilirsiniz." };
  }

  const { error } = await adminClient
    .from("training_participants")
    .delete()
    .eq("training_id", lessonId)
    .eq("profile_id", participantId);
  if (error) return { error: `Sporcu cikarilamadi: ${error.message}` };
  await logAuditEvent({
    actorUserId: actor.id,
    actorRole: actor.role,
    organizationId: orgId,
    action: "lesson.participant.remove",
    entityType: "training_participant",
    entityId: lessonId,
  });

  revalidatePath(`/dersler/${lessonId}`);
  return { success: true };
}

export async function updateLesson(formData: FormData) {
  const schemaError = await assertCriticalSchemaReady(["coach_permissions"]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_edit_lessons")) {
      return { error: "Ders duzenleme yetkiniz yok." };
    }
  }

  const lessonId = formData.get("lessonId")?.toString().trim() || "";
  const title = formData.get("title")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim() || "";
  const startTimeRaw = formData.get("startTime")?.toString() || "";
  const endTimeRaw = formData.get("endTime")?.toString() || "";
  const startTime = parseLessonFormInstantToUtcIso(startTimeRaw);
  const endTime = parseLessonFormInstantToUtcIso(endTimeRaw);
  const capacity = Number(formData.get("capacity")?.toString() || "20");

  if (!lessonId) return { error: "Ders kimligi gerekli." };
  if (!title || !location || !startTime || !endTime) return { error: "Baslik, lokasyon, baslangic ve bitis zorunludur." };
  if (Number.isNaN(capacity) || capacity <= 0) return { error: "Kapasite pozitif olmalidir." };
  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    return { error: "Bitis saati baslangictan sonra olmalidir." };
  }

  const orgId = actor.organization_id!;
  const adminClient = createSupabaseAdminClient();
  const { data: lesson } = await adminClient
    .from("training_schedule")
    .select("id, coach_id, organization_id, status")
    .eq("id", lessonId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!lesson) return { error: "Ders bulunamadi." };
  if (lesson.status === "cancelled") return { error: "Iptal edilmis ders duzenlenemez." };
  if (role === "coach" && lesson.coach_id !== actor.id) {
    return { error: "Sadece kendi dersinizi duzenleyebilirsiniz." };
  }

  const coachId = lesson.coach_id as string;
  const { data: coachProfile } = await adminClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", coachId)
    .maybeSingle();
  if (!coachProfile || getSafeRole(coachProfile.role) !== "coach") {
    return { error: "Bu dersin kocu gecersiz." };
  }
  if (isInactiveCoachProfile(coachProfile.role, coachProfile.is_active)) {
    return { error: "Bu dersin koc hesabi pasif; once kocu aktif edin." };
  }

  const { count } = await adminClient
    .from("training_participants")
    .select("profile_id", { count: "exact", head: true })
    .eq("training_id", lessonId);
  const enrolled = count ?? 0;
  if (capacity < enrolled) {
    return { error: `Kapasite mevcut katilimci sayisindan (${enrolled}) kucuk olamaz.` };
  }

  const { data: coachLessons } = await adminClient
    .from("training_schedule")
    .select("id, start_time, end_time, status")
    .eq("organization_id", orgId)
    .eq("coach_id", coachId)
    .neq("status", "cancelled")
    .neq("id", lessonId);

  const coachHasConflict = (coachLessons as ExistingLesson[] | null)?.some((l) =>
    hasTimeOverlap(startTime, endTime, l.start_time, l.end_time)
  );
  if (coachHasConflict) return { error: "Koc bu saat araliginda baska bir derste." };

  const { data: participantRows } = await adminClient.from("training_participants").select("profile_id").eq("training_id", lessonId);
  const athleteIds = (participantRows || []).map((p) => p.profile_id).filter(Boolean);

  if (athleteIds.length > 0) {
    const { data: athleteLessons } = await adminClient
      .from("training_participants")
      .select("profile_id, training_schedule!inner(id, start_time, end_time, status, organization_id)")
      .in("profile_id", athleteIds)
      .eq("training_schedule.organization_id", orgId)
      .neq("training_schedule.status", "cancelled");

    const hasAthleteConflict = ((athleteLessons || []) as ParticipantWithSchedule[]).some((row) => {
      const schedule = Array.isArray(row.training_schedule) ? row.training_schedule[0] : row.training_schedule;
      if (!schedule || schedule.id === lessonId) return false;
      return hasTimeOverlap(startTime, endTime, schedule.start_time, schedule.end_time);
    });
    if (hasAthleteConflict) return { error: "Katilimcilardan biri bu saatte baska bir derste." };
  }

  const { error } = await adminClient
    .from("training_schedule")
    .update({
      title,
      description,
      location,
      start_time: startTime,
      end_time: endTime,
      capacity,
    })
    .eq("id", lessonId);

  if (error) return { error: `Ders guncellenemedi: ${error.message}` };
  await logAuditEvent({
    actorUserId: actor.id,
    actorRole: actor.role,
    organizationId: orgId,
    action: "lesson.update",
    entityType: "lesson",
    entityId: lessonId,
  });

  revalidatePath("/dersler");
  revalidatePath(`/dersler/${lessonId}`);
  revalidatePath("/antrenman-yonetimi");
  return { success: true };
}

export async function cancelLesson(lessonId: string) {
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_edit_lessons")) {
      return { error: "Ders duzenleme yetkiniz yok." };
    }
  }

  const orgId = actor.organization_id!;
  const adminClient = createSupabaseAdminClient();
  const { data: lesson } = await adminClient
    .from("training_schedule")
    .select("id, title, coach_id, organization_id, start_time, end_time")
    .eq("id", lessonId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!lesson) return { error: "Ders bulunamadi." };
  if (role === "coach" && lesson.coach_id !== actor.id) return { error: "Sadece kendi dersinizi iptal edebilirsiniz." };

  const { error } = await adminClient
    .from("training_schedule")
    .update({ status: "cancelled" })
    .eq("id", lessonId);
  if (error) return { error: `Ders iptal edilemedi: ${error.message}` };
  await logAuditEvent({
    actorUserId: actor.id,
    actorRole: actor.role,
    organizationId: orgId,
    action: "lesson.cancel",
    entityType: "lesson",
    entityId: lessonId,
  });

  const { data: participants } = await adminClient
    .from("training_participants")
    .select("profile_id")
    .eq("training_id", lessonId);

  const recipientIds = [
    lesson.coach_id,
    ...(participants || []).map((p) => p.profile_id),
  ].filter((id): id is string => Boolean(id));

  await insertNotificationsForUsers(
    recipientIds,
    buildLessonCancelledNotificationMessage(
      lesson.title || "Ders",
      lesson.start_time,
      lesson.end_time
    )
  );

  revalidatePath("/dersler");
  revalidatePath(`/dersler/${lessonId}`);
  revalidatePath("/haftalik-ders-programi");
  revalidatePath("/antrenman-yonetimi");
  revalidatePath("/bildirimler");
  return { success: true };
}

export async function hardDeleteLesson(lessonId: string) {
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin") return { error: "Kalıcı silme işlemi yalnızca yönetici için açıktır." };

  const orgId = actor.organization_id!;
  const adminClient = createSupabaseAdminClient();
  const { data: lesson } = await adminClient
    .from("training_schedule")
    .select("id, title, coach_id, organization_id, start_time, end_time")
    .eq("id", lessonId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!lesson) return { error: "Ders bulunamadi." };

  const { data: participants } = await adminClient
    .from("training_participants")
    .select("profile_id")
    .eq("training_id", lessonId);

  const { error: deleteParticipantsErr } = await adminClient
    .from("training_participants")
    .delete()
    .eq("training_id", lessonId);
  if (deleteParticipantsErr) return { error: `Katılımcılar silinemedi: ${deleteParticipantsErr.message}` };

  const { error: deleteLessonErr } = await adminClient
    .from("training_schedule")
    .delete()
    .eq("id", lessonId)
    .eq("organization_id", orgId);
  if (deleteLessonErr) return { error: `Ders kalıcı silinemedi: ${deleteLessonErr.message}` };

  await logAuditEvent({
    actorUserId: actor.id,
    actorRole: actor.role,
    organizationId: orgId,
    action: "lesson.cancel",
    entityType: "lesson",
    entityId: lessonId,
    metadata: { op: "hard_delete" },
  });

  const recipientIds = [
    lesson.coach_id,
    ...(participants || []).map((p) => p.profile_id),
  ].filter((id): id is string => Boolean(id));
  await insertNotificationsForUsers(
    recipientIds,
    buildLessonCancelledNotificationMessage(
      lesson.title || "Ders",
      lesson.start_time,
      lesson.end_time
    )
  );

  revalidatePath("/dersler");
  revalidatePath("/haftalik-ders-programi");
  revalidatePath("/antrenman-yonetimi");
  revalidatePath("/bildirimler");
  return { success: true };
}

export async function markNotificationRead(notificationId: string) {
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", actor.id);
  if (error) return { error: `Bildirim guncellenemedi: ${error.message}` };
  revalidatePath("/bildirimler");
  return { success: true };
}

export type LessonManagementDetailAthlete = {
  id: string;
  full_name: string;
  is_active?: boolean | null;
  attendance_status?: "registered" | "attended" | "missed" | "cancelled" | null;
};

export async function getLessonManagementDetail(lessonId: string): Promise<
  | {
      actorId: string;
      role: "admin" | "coach";
      permissions: CoachPermissions;
      lesson: Lesson;
      participants: LessonManagementDetailAthlete[];
      allAthletes: LessonManagementDetailAthlete[];
    }
  | { error: string }
> {
  if (!isUuid(lessonId.trim())) {
    return { error: "Gecersiz ders kimligi." };
  }

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: "Bu sayfaya erisim yetkiniz yok." };
  }

  const orgId = actor.organization_id!;
  const adminClient = createSupabaseAdminClient();
  const permissions: CoachPermissions =
    role === "coach" ? await getCoachPermissions(actor.id, orgId) : DEFAULT_COACH_PERMISSIONS;

  const { data: lessonRow, error: lessonErr } = await adminClient
    .from("training_schedule")
    .select("*")
    .eq("id", lessonId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (lessonErr || !lessonRow) return { error: "Ders bulunamadi." };

  const lesson = mapLesson(lessonRow);
  if (role === "coach" && !coachMayCoordinateOrgLesson(permissions, lesson.coachId ?? null, actor.id)) {
    return { error: "Sadece kendi ders detayinizi gorebilirsiniz." };
  }

  const { data: participantRows, error: partErr } = await adminClient
    .from("training_participants")
    .select("profile_id, attendance_status")
    .eq("training_id", lessonId);

  if (partErr) return { error: `Katilimci listesi alinamadi: ${partErr.message}` };

  const participantIds = Array.from(new Set((participantRows || []).map((row) => row.profile_id).filter(Boolean)));
  let participants: LessonManagementDetailAthlete[] = [];
  if (participantIds.length > 0) {
    const { data: profileRows, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", participantIds)
      .eq("organization_id", orgId);
    if (profileErr) return { error: `Katilimci profilleri alinamadi: ${profileErr.message}` };

    const profileMap = new Map((profileRows || []).map((row) => [row.id, row]));
    participants = participantIds.map((profileId) => {
      const attendanceRow = (participantRows || []).find((row) => row.profile_id === profileId);
      const profile = profileMap.get(profileId);
      return {
        id: profile?.id || profileId,
        full_name: toDisplayName(profile?.full_name ?? null, profile?.email ?? null, "Sporcu"),
        attendance_status: (attendanceRow?.attendance_status ||
          "registered") as "registered" | "attended" | "missed" | "cancelled",
      };
    });
  }

  const { data: athleteRows, error: athErr } = await adminClient
    .from("profiles")
    .select("id, full_name, email, is_active, role")
    .eq("organization_id", orgId)
    .eq("role", "sporcu")
    .order("full_name");

  if (athErr) {
    return { error: `Sporcu listesi alinamadi: ${athErr.message}` };
  }

  const allAthletes: LessonManagementDetailAthlete[] = (athleteRows || [])
    .filter((r) => getSafeRole(r.role) === "sporcu")
    .map((r) => ({
      id: r.id,
      full_name: toDisplayName(r.full_name, r.email, "Sporcu"),
      is_active: r.is_active,
    }));

  return {
    actorId: actor.id,
    role,
    permissions,
    lesson,
    participants,
    allAthletes,
  };
}
