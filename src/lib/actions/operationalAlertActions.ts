"use server";

/**
 * Faz 14.4 — Operational alerts: acknowledge / resolve (admin/super_admin, audit zorunlu).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { isUuid } from "@/lib/validation/uuid";

type Result = { ok: true } | { ok: false; error: string; errorKind?: "auth" | "permission" | "validation" | "fetch" };

function canAccessAlert(params: {
  actorOrgId: string | null;
  actorRole: string;
  alertOrgId: string | null;
}): boolean {
  if (params.actorRole === "super_admin") return true;
  if (!params.actorOrgId) return false;
  return params.alertOrgId === null || params.alertOrgId === params.actorOrgId;
}

export async function acknowledgeOperationalAlert(input: { alertId: string }): Promise<Result> {
  return withServerActionGuard("operational.acknowledgeAlert", async () => {
    if (!isUuid(input.alertId)) return { ok: false, error: "Geçersiz uyarı id.", errorKind: "validation" };
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) return { ok: false, error: resolved.error, errorKind: "auth" };
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      return { ok: false, error: "Yetkisiz.", errorKind: "permission" };
    }
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("peaker_operational_alerts")
      .select("id, organization_id, resolved_at, acknowledged_at")
      .eq("id", input.alertId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, errorKind: "fetch" };
    if (!row) return { ok: false, error: "Uyarı bulunamadı.", errorKind: "validation" };
    if (row.resolved_at) return { ok: false, error: "Uyarı zaten çözümlenmiş.", errorKind: "validation" };
    if (!canAccessAlert({ actorOrgId: resolved.actor.organizationId, actorRole: role, alertOrgId: row.organization_id })) {
      return { ok: false, error: "Bu uyarıya erişim yok.", errorKind: "permission" };
    }
    if (row.acknowledged_at) {
      return { ok: true };
    }
    const { error: upErr } = await admin
      .from("peaker_operational_alerts")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: resolved.actor.id,
      })
      .eq("id", input.alertId);
    if (upErr) return { ok: false, error: upErr.message, errorKind: "fetch" };
    await logAuditEvent({
      organizationId: row.organization_id,
      actorUserId: resolved.actor.id,
      actorRole: resolved.actor.role,
      action: "operational.alert.acknowledge",
      entityType: "async_job",
      entityId: input.alertId,
      metadata: {},
    });
    return { ok: true };
  });
}

export async function resolveOperationalAlert(input: { alertId: string }): Promise<Result> {
  return withServerActionGuard("operational.resolveAlert", async () => {
    if (!isUuid(input.alertId)) return { ok: false, error: "Geçersiz uyarı id.", errorKind: "validation" };
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) return { ok: false, error: resolved.error, errorKind: "auth" };
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      return { ok: false, error: "Yetkisiz.", errorKind: "permission" };
    }
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("peaker_operational_alerts")
      .select("id, organization_id, resolved_at")
      .eq("id", input.alertId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, errorKind: "fetch" };
    if (!row) return { ok: false, error: "Uyarı bulunamadı.", errorKind: "validation" };
    if (row.resolved_at) return { ok: false, error: "Uyarı zaten çözümlenmiş.", errorKind: "validation" };
    if (!canAccessAlert({ actorOrgId: resolved.actor.organizationId, actorRole: role, alertOrgId: row.organization_id })) {
      return { ok: false, error: "Bu uyarıya erişim yok.", errorKind: "permission" };
    }
    const { error: upErr } = await admin
      .from("peaker_operational_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", input.alertId);
    if (upErr) return { ok: false, error: upErr.message, errorKind: "fetch" };
    await logAuditEvent({
      organizationId: row.organization_id,
      actorUserId: resolved.actor.id,
      actorRole: resolved.actor.role,
      action: "operational.alert.resolve",
      entityType: "async_job",
      entityId: input.alertId,
      metadata: {},
    });
    return { ok: true };
  });
}
