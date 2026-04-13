"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CoachPermissionKey, CoachPermissions } from "@/lib/types";
import { COACH_PERMISSION_KEYS, DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function resolveCoachPermissionActor() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) return { error: "Gecersiz oturum." as const };

  const { data: actor } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  const r = getSafeRole(actor?.role);
  if (r === "super_admin" && actor) return { kind: "super_admin" as const, actorId: actor.id, actorRole: actor.role, organizationId: null as string | null };
  if (r === "admin" && actor?.organization_id) {
    return { kind: "admin" as const, organizationId: actor.organization_id, actorId: actor.id, actorRole: actor.role };
  }
  return { error: "Bu islem icin admin veya super admin yetkisi gerekir." as const };
}

export async function updateCoachPermissions(coachId: string, updates: Partial<CoachPermissions>) {
  return withServerActionGuard("permission.updateCoachPermissions", async () => {
  if (!assertUuid(coachId)) {
    return { error: "Gecersiz koc kimligi." };
  }

  const resolved = await resolveCoachPermissionActor();
  if ("error" in resolved) return { error: resolved.error };
  const adminClient = createSupabaseAdminClient();

  let coachQuery = adminClient.from("profiles").select("id, role, organization_id").eq("id", coachId);
  if (resolved.kind === "admin") {
    coachQuery = coachQuery.eq("organization_id", resolved.organizationId);
  }
  const { data: coachProfile } = await coachQuery.maybeSingle();

  if (!coachProfile || getSafeRole(coachProfile.role) !== "coach" || !coachProfile.organization_id) {
    return { error: "Koc bulunamadi." };
  }

  const payload: Partial<Record<CoachPermissionKey, boolean>> = {};
  COACH_PERMISSION_KEYS.forEach((key) => {
    if (typeof updates[key] === "boolean") payload[key] = updates[key];
  });

  const { error } = await adminClient.from("coach_permissions").upsert(
    {
      coach_id: coachId,
      organization_id: coachProfile.organization_id,
      ...DEFAULT_COACH_PERMISSIONS,
      ...payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "coach_id" }
  );
  if (error) return { error: `Yetkiler kaydedilemedi: ${error.message}` };

  await logAuditEvent({
    organizationId: coachProfile.organization_id,
    actorUserId: resolved.actorId,
    actorRole: resolved.actorRole,
    action: "permission.coach.update",
    entityType: "coach_permission",
    entityId: coachId,
  });

  revalidatePath(`/koclar/${coachId}`);
  return { success: true };
  });
}
