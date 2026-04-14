"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

const ATTENDANCE_STATUSES = ["registered", "attended", "missed", "cancelled"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

async function resolveActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." as const };
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };
  return { actor };
}

async function canManageTraining(actor: { id: string; role: string; organization_id: string }, trainingId: string) {
  if (!assertUuid(trainingId)) return { error: "Gecersiz ders kimligi." };

  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };

  const adminClient = createSupabaseAdminClient();
  const { data: training } = await adminClient
    .from("training_schedule")
    .select("id, coach_id, organization_id")
    .eq("id", trainingId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!training) return { error: "Ders bulunamadi." };

  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!permissions.can_view_all_organization_lessons && training.coach_id !== actor.id) {
      return { error: "Sadece kendi dersinizde islem yapabilirsiniz." };
    }
    return { role, permissions, adminClient };
  }
  return { role, adminClient };
}

export async function addTrainingParticipant(trainingId: string, profileId: string) {
  if (!assertUuid(trainingId) || !assertUuid(profileId)) {
    return { error: "Gecersiz ders veya sporcu kimligi." };
  }

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const permissionResult = await canManageTraining(actor as { id: string; role: string; organization_id: string }, trainingId);
  if ("error" in permissionResult) return { error: permissionResult.error };
  if (permissionResult.role === "coach") {
    if (!hasCoachPermission(permissionResult.permissions, "can_add_athletes_to_lessons")) {
      return { error: "Derse sporcu ekleme yetkiniz yok." };
    }
  }

  const { data: athleteOk } = await permissionResult.adminClient
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("organization_id", actor.organization_id)
    .eq("role", "sporcu")
    .maybeSingle();
  if (!athleteOk) {
    return { error: "Sporcu bulunamadi veya bu organizasyona ait degil." };
  }

  const { error } = await permissionResult.adminClient
    .from("training_participants")
    .insert([{ training_id: trainingId, profile_id: profileId, attendance_status: "registered" }]);
  if (error) return { error: error.message.includes("duplicate") ? "Bu sporcu zaten bu derse ekli." : `Sporcu eklenemedi: ${error.message}` };

  await logAuditEvent({
    organizationId: actor.organization_id,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "lesson.participant.add",
    entityType: "training_participant",
    entityId: trainingId,
    metadata: { profileId },
  });

  revalidatePath("/antrenman-yonetimi");
  revalidatePath(`/dersler/${trainingId}`);
  return { success: true };
}

export async function setAttendanceStatus(trainingId: string, profileId: string, status: AttendanceStatus) {
  if (!assertUuid(trainingId) || !assertUuid(profileId)) {
    return { error: "Gecersiz ders veya sporcu kimligi." };
  }

  const schemaError = await assertCriticalSchemaReady(["coach_permissions", "attendance_status"]);
  if (schemaError) return { error: schemaError };
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  if (!ATTENDANCE_STATUSES.includes(status)) return { error: "Gecersiz yoklama durumu." };

  const permissionResult = await canManageTraining(actor as { id: string; role: string; organization_id: string }, trainingId);
  if ("error" in permissionResult) return { error: permissionResult.error };
  if (permissionResult.role === "coach") {
    if (!hasCoachPermission(permissionResult.permissions, "can_take_attendance")) {
      return { error: "Yoklama alma yetkiniz yok." };
    }
  }

  const { data: participant } = await permissionResult.adminClient
    .from("training_participants")
    .select("training_id, profile_id")
    .eq("training_id", trainingId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!participant) return { error: "Sporcu bu derse kayitli degil." };

  const { data: profileInOrg } = await permissionResult.adminClient
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!profileInOrg) return { error: "Sporcu bu organizasyona ait degil." };

  const isPresent = status === "attended" ? true : status === "missed" ? false : null;
  const { error } = await permissionResult.adminClient
    .from("training_participants")
    .update({
      attendance_status: status,
      is_present: isPresent,
      marked_by: actor.id,
      marked_at: new Date().toISOString(),
    })
    .eq("training_id", trainingId)
    .eq("profile_id", profileId);
  if (error) return { error: `Yoklama guncellenemedi: ${error.message}` };

  await logAuditEvent({
    organizationId: actor.organization_id,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "attendance.status.update",
    entityType: "attendance",
    entityId: trainingId,
    metadata: { profileId, status },
  });

  revalidatePath("/antrenman-yonetimi");
  revalidatePath(`/dersler/${trainingId}`);
  return { success: true };
}

export async function setTrainingAttendance(trainingId: string, profileId: string, status: boolean) {
  return setAttendanceStatus(trainingId, profileId, status ? "attended" : "missed");
}
