"use server";

/**
 * Faz 14.7 — Operational replay tooling (admin/super_admin, audit + tenant-safe).
 */

import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { isUuid } from "@/lib/validation/uuid";
import { createJobContext } from "@/lib/jobs/createJobContext";
import { enqueueJob } from "@/lib/jobs/enqueueJob";
import { getSystemOperationsSnapshot } from "@/lib/actions/systemOperationsActions";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string; errorKind?: "auth" | "permission" | "validation" | "fetch" };
export type OperationalReplayResult<T = Record<string, unknown>> = Ok<T> | Err;

export async function replayOperationalAlertEvaluation(input?: {
  replayReason?: string | null;
}): Promise<OperationalReplayResult<{ refreshed: boolean }>> {
  return withServerActionGuard("operational.replayEvaluateAlerts", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) return { ok: false, error: resolved.error, errorKind: "auth" };
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      return { ok: false, error: "Yetkisiz.", errorKind: "permission" };
    }
    const snap = await getSystemOperationsSnapshot();
    if ("error" in snap) return { ok: false, error: snap.error, errorKind: "fetch" };
    await logAuditEvent({
      organizationId: resolved.actor.organizationId,
      actorUserId: resolved.actor.id,
      actorRole: resolved.actor.role,
      action: "operational.replay.evaluate_alerts",
      entityType: "organization",
      entityId: resolved.actor.organizationId ?? resolved.actor.id,
      metadata: {
        alertCount: snap.operationalAlerts.filter((a) => !a.resolvedAt).length,
        reason: input?.replayReason ?? null,
      },
    });
    return { ok: true, refreshed: true };
  });
}

export async function replayEnqueueAuditExport(input: {
  organizationId?: string | null;
  action?: string | null;
  entityType?: string | null;
  fromIso?: string | null;
  toIso?: string | null;
  replayReason?: string | null;
}): Promise<OperationalReplayResult<{ jobStatus: string }>> {
  return withServerActionGuard("operational.replayExportAudit", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) return { ok: false, error: resolved.error, errorKind: "auth" };
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      return { ok: false, error: "Yetkisiz.", errorKind: "permission" };
    }
    let orgId: string | null =
      role === "admin" ? resolved.actor.organizationId : (input.organizationId || "").trim() || null;
    if (role === "admin" && !orgId) {
      return { ok: false, error: "Organizasyon gerekli.", errorKind: "validation" };
    }
    if (role === "super_admin" && input.organizationId) {
      if (!isUuid(input.organizationId)) {
        return { ok: false, error: "Geçersiz organizasyon.", errorKind: "validation" };
      }
      orgId = input.organizationId;
    }
    const ctx = createJobContext({
      kind: "export.audit",
      initiator: { kind: "user", id: resolved.actor.id, role: resolved.actor.role },
      organizationId: orgId,
      attributes: {
        organizationId: orgId,
        action: input.action ?? null,
        entityType: input.entityType ?? null,
        fromIso: input.fromIso ?? null,
        toIso: input.toIso ?? null,
        initiatorUserId: resolved.actor.id,
        replay: true,
        replayReason: input.replayReason ?? null,
      },
    });
    const result = await enqueueJob(ctx, {
      retry: { maxAttempts: 3, backoffMs: 2000 },
      cancellationKey: `export:audit:replay:${ctx.jobId}`,
    });
    await logAuditEvent({
      organizationId: orgId,
      actorUserId: resolved.actor.id,
      actorRole: resolved.actor.role,
      action: "operational.replay.export_audit",
      entityType: "async_job",
      entityId: result.status === "enqueued" ? result.jobId : ctx.jobId,
      metadata: { enqueueStatus: result.status, jobKind: "export.audit", reason: input.replayReason ?? null },
    });
    return { ok: true, jobStatus: result.status };
  });
}

export async function replayEnqueueRetentionAudit(input?: {
  replayReason?: string | null;
}): Promise<OperationalReplayResult<{ jobStatus: string }>> {
  return withServerActionGuard("operational.replayRetentionAudit", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) return { ok: false, error: resolved.error, errorKind: "auth" };
    const role = getSafeRole(resolved.actor.role);
    if (role !== "super_admin") {
      return { ok: false, error: "Yalnızca super_admin tetikleyebilir.", errorKind: "permission" };
    }
    const ctx = createJobContext({
      kind: "retention.auditLogs",
      initiator: { kind: "user", id: resolved.actor.id, role: resolved.actor.role },
      organizationId: null,
      attributes: { retentionDays: 365, replayReason: input?.replayReason ?? null },
    });
    const result = await enqueueJob(ctx, { retry: { maxAttempts: 2, backoffMs: 5000 } });
    await logAuditEvent({
      organizationId: null,
      actorUserId: resolved.actor.id,
      actorRole: resolved.actor.role,
      action: "operational.replay.retention_audit",
      entityType: "async_job",
      entityId: result.status === "enqueued" ? result.jobId : ctx.jobId,
      metadata: {
        enqueueStatus: result.status,
        jobKind: "retention.auditLogs",
        reason: input?.replayReason ?? null,
      },
    });
    return { ok: true, jobStatus: result.status };
  });
}
