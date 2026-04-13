"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function resolveAdminOrg() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) return { error: "Gecersiz oturum." as const };

  const { data: actor } = await sessionClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) return { error: "Kullanici profili dogrulanamadi." as const };

  const r = getSafeRole(actor?.role);
  if (r === "super_admin") {
    return { kind: "super_admin" as const, actorId: actor.id, actorRole: actor.role };
  }
  if (r === "admin" && actor?.organization_id) {
    return { kind: "admin" as const, organizationId: actor.organization_id as string, actorId: actor.id, actorRole: actor.role };
  }
  return { error: "Bu islem yalnizca organizasyon admini veya super admin icindir." as const };
}

export async function setCoachAccountActive(coachId: string, active: boolean) {
  return withServerActionGuard("coachLifecycle.setCoachAccountActive", async () => {
  if (!assertUuid(coachId)) return { error: "Gecersiz koc kimligi." };

  const resolved = await resolveAdminOrg();
  if ("error" in resolved) return { error: resolved.error };

  const adminClient = createSupabaseAdminClient();
  let targetQuery = adminClient
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", coachId);
  if (resolved.kind === "admin") {
    targetQuery = targetQuery.eq("organization_id", resolved.organizationId);
  }
  const { data: target, error: fetchErr } = await targetQuery.maybeSingle();

  if (fetchErr || !target) return { error: "Koc bulunamadi veya bu organizasyona ait degil." };
  if (getSafeRole(target.role) !== "coach" || !target.organization_id) {
    return { error: "Yalnizca koc hesaplari yonetilebilir." };
  }

  const { error: updateErr } = await adminClient
    .from("profiles")
    .update({ is_active: active })
    .eq("id", coachId)
    .eq("organization_id", target.organization_id);

  if (updateErr) return { error: `Guncellenemedi: ${updateErr.message}` };

  await logAuditEvent({
    organizationId: target.organization_id,
    actorUserId: resolved.actorId,
    actorRole: resolved.actorRole,
    action: "coach.lifecycle.update",
    entityType: "coach",
    entityId: coachId,
    metadata: { active },
  });

  revalidatePath("/koclar");
  revalidatePath(`/koclar/${coachId}`);
  return { success: true as const };
  });
}

export async function deactivateCoachAction(coachId: string) {
  return setCoachAccountActive(coachId, false);
}

export async function reactivateCoachAction(coachId: string) {
  return setCoachAccountActive(coachId, true);
}
