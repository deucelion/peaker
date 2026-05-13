"use server";

/**
 * Faz 13.2 — Org-scoped async queue admin operations (admin / super_admin).
 * Audit + operational timeline zorunlu; service_role ile güvenli RPC kullanımı.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import { isUuid } from "@/lib/validation/uuid";
import { logger } from "@/lib/monitoring/logger";

const MAIN_QUEUE = "peaker_jobs";

type ActionError = { ok: false; error: string; errorKind?: "auth" | "permission" | "validation" | "fetch" };

export type QueueAdminActionResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & T)
  | ActionError;

type JobRow = {
  id: string;
  organization_id: string | null;
  job_kind: string;
  status: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  pgmq_msg_id: number | null;
  idempotency_key: string | null;
};

async function requireAdminActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error as string, actor: null as null };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu işlem için admin yetkisi gerekir.", actor: null as null };
  }
  return { error: null as null, actor: resolved.actor };
}

function canAccessJobOrg(params: {
  actorOrgId: string | null;
  actorRole: string;
  jobOrgId: string | null;
}): boolean {
  if (params.actorRole === "super_admin") return true;
  if (!params.jobOrgId) return false;
  return params.actorOrgId === params.jobOrgId;
}

function effectiveOrgIdForBulk(params: {
  actorRole: string;
  actorOrgId: string | null;
  requestedOrgId: string | null | undefined;
}): string | null {
  if (params.actorRole === "super_admin") {
    if (!params.requestedOrgId || !isUuid(params.requestedOrgId)) return null;
    return params.requestedOrgId;
  }
  return params.actorOrgId;
}

async function fetchJob(admin: ReturnType<typeof createSupabaseAdminClient>, jobId: string) {
  const { data, error } = await admin
    .from("peaker_jobs_log")
    .select("id, organization_id, job_kind, status, attempts, max_attempts, payload, pgmq_msg_id, idempotency_key")
    .eq("id", jobId)
    .maybeSingle();
  if (error) return { job: null as JobRow | null, error: error.message };
  return { job: data as JobRow | null, error: null as null };
}

async function requeueJobRow(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: JobRow
): Promise<{ ok: true; newMsgId: number | null } | { ok: false; error: string }> {
  const { data: msgId, error: sendErr } = await admin.rpc("peaker_pgmq_send", {
    p_queue_name: MAIN_QUEUE,
    p_payload: job.payload ?? {},
  });
  if (sendErr) {
    return { ok: false, error: sendErr.message };
  }
  const newMsgId = typeof msgId === "number" ? msgId : msgId != null ? Number(msgId) : null;
  if (newMsgId == null || !Number.isFinite(newMsgId)) {
    return { ok: false, error: "pgmq.send mesaj üretemedi (extension veya kuyruk kapalı olabilir)." };
  }
  const { error: upErr } = await admin
    .from("peaker_jobs_log")
    .update({
      status: "queued",
      pgmq_msg_id: newMsgId,
      attempts: 0,
      error_kind: null,
      error_message: null,
      finished_at: null,
      started_at: null,
      next_run_at: new Date().toISOString(),
      result: null,
    })
    .eq("id", job.id);
  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  return { ok: true, newMsgId };
}

export async function queueAdminRetrySingleJob(input: {
  jobId: string;
}): Promise<QueueAdminActionResult<{ newMsgId: number | null }>> {
  return withServerActionGuard("queueAdmin.retrySingleJob", async () => {
    const gate = await requireAdminActor();
    if (gate.error || !gate.actor) return { ok: false, error: gate.error, errorKind: "auth" };
    if (!isUuid(input.jobId)) {
      return { ok: false, error: "Geçersiz job id.", errorKind: "validation" };
    }
    const admin = createSupabaseAdminClient();
    const { job, error } = await fetchJob(admin, input.jobId);
    if (error) return { ok: false, error, errorKind: "fetch" };
    if (!job) return { ok: false, error: "Job bulunamadı.", errorKind: "validation" };
    if (!canAccessJobOrg({ actorOrgId: gate.actor.organizationId, actorRole: gate.actor.role, jobOrgId: job.organization_id })) {
      return { ok: false, error: "Bu job için yetkiniz yok.", errorKind: "permission" };
    }
    if (job.status !== "failed" && job.status !== "dead_letter") {
      return { ok: false, error: "Yalnızca failed veya dead_letter job yeniden kuyruklanabilir.", errorKind: "validation" };
    }
    const rq = await requeueJobRow(admin, job);
    if (!rq.ok) return { ok: false, error: rq.error, errorKind: "fetch" };

    await logAuditEvent({
      organizationId: job.organization_id,
      actorUserId: gate.actor.id,
      actorRole: gate.actor.role,
      action: "job.queue.retry_single",
      entityType: "async_job",
      entityId: job.id,
      metadata: { jobKind: job.job_kind, previousStatus: job.status, newMsgId: rq.newMsgId },
    });
    await appendOperationalTimeline(admin, {
      organizationId: job.organization_id,
      eventType: "queue.job.retry_single",
      severity: "info",
      summary: `Job requeued: ${job.job_kind}`,
      payload: { jobId: job.id, newMsgId: rq.newMsgId },
      actorUserId: gate.actor.id,
    });
    return { ok: true, newMsgId: rq.newMsgId };
  });
}

export async function queueAdminRetryAllRetryable(input: {
  /** super_admin için zorunlu */
  organizationId?: string | null;
  limit?: number;
}): Promise<QueueAdminActionResult<{ retried: number; errors: string[] }>> {
  return withServerActionGuard("queueAdmin.retryAllRetryable", async () => {
    const gate = await requireAdminActor();
    if (gate.error || !gate.actor) return { ok: false, error: gate.error, errorKind: "auth" };
    const orgId = effectiveOrgIdForBulk({
      actorRole: gate.actor.role,
      actorOrgId: gate.actor.organizationId,
      requestedOrgId: input.organizationId,
    });
    if (gate.actor.role !== "super_admin" && !orgId) {
      return { ok: false, error: "Organizasyon bağlamı eksik.", errorKind: "permission" };
    }
    if (gate.actor.role === "super_admin" && !orgId) {
      return { ok: false, error: "super_admin için organizationId gerekli.", errorKind: "validation" };
    }
    const limit = Math.min(50, Math.max(1, input.limit ?? 25));
    const admin = createSupabaseAdminClient();
    let q = admin
      .from("peaker_jobs_log")
      .select("id, organization_id, job_kind, status, attempts, max_attempts, payload, pgmq_msg_id, idempotency_key")
      .in("status", ["failed", "dead_letter"])
      .order("finished_at", { ascending: false })
      .limit(limit);
    q = q.eq("organization_id", orgId!);
    const { data: rows, error } = await q;
    if (error) return { ok: false, error: error.message, errorKind: "fetch" };
    const jobs = (rows ?? []) as JobRow[];
    let retried = 0;
    const errors: string[] = [];
    for (const job of jobs) {
      const rq = await requeueJobRow(admin, job);
      if (rq.ok) retried += 1;
      else errors.push(`${job.id}: ${rq.error}`);
    }
    await logAuditEvent({
      organizationId: orgId,
      actorUserId: gate.actor.id,
      actorRole: gate.actor.role,
      action: "job.queue.retry_all",
      entityType: "async_job",
      entityId: orgId ?? "global",
      metadata: { retried, attempted: jobs.length, limit, errors: errors.slice(0, 5) },
    });
    await appendOperationalTimeline(admin, {
      organizationId: orgId,
      eventType: "queue.job.retry_all",
      severity: errors.length ? "warning" : "info",
      summary: `Retry all: ${retried}/${jobs.length} requeued`,
      payload: { retried, attempted: jobs.length, errorSample: errors.slice(0, 3) },
      actorUserId: gate.actor.id,
    });
    return { ok: true, retried, errors };
  });
}

export async function queueAdminDlqRequeue(input: {
  jobId: string;
}): Promise<QueueAdminActionResult<{ newMsgId: number | null }>> {
  return withServerActionGuard("queueAdmin.dlqRequeue", async () => {
    const gate = await requireAdminActor();
    if (gate.error || !gate.actor) return { ok: false, error: gate.error, errorKind: "auth" };
    if (!isUuid(input.jobId)) {
      return { ok: false, error: "Geçersiz job id.", errorKind: "validation" };
    }
    const admin = createSupabaseAdminClient();
    const { job, error } = await fetchJob(admin, input.jobId);
    if (error) return { ok: false, error, errorKind: "fetch" };
    if (!job) return { ok: false, error: "Job bulunamadı.", errorKind: "validation" };
    if (!canAccessJobOrg({ actorOrgId: gate.actor.organizationId, actorRole: gate.actor.role, jobOrgId: job.organization_id })) {
      return { ok: false, error: "Bu job için yetkiniz yok.", errorKind: "permission" };
    }
    if (job.status !== "dead_letter") {
      return { ok: false, error: "Yalnızca dead_letter (DLQ) job geri alınabilir.", errorKind: "validation" };
    }
    const rq = await requeueJobRow(admin, job);
    if (!rq.ok) return { ok: false, error: rq.error, errorKind: "fetch" };

    await logAuditEvent({
      organizationId: job.organization_id,
      actorUserId: gate.actor.id,
      actorRole: gate.actor.role,
      action: "job.queue.dlq_requeue",
      entityType: "async_job",
      entityId: job.id,
      metadata: { jobKind: job.job_kind, newMsgId: rq.newMsgId },
    });
    await appendOperationalTimeline(admin, {
      organizationId: job.organization_id,
      eventType: "queue.job.dlq_requeue",
      severity: "info",
      summary: `DLQ → main queue: ${job.job_kind}`,
      payload: { jobId: job.id, newMsgId: rq.newMsgId },
      actorUserId: gate.actor.id,
    });
    return { ok: true, newMsgId: rq.newMsgId };
  });
}

export async function queueAdminCancelQueuedJob(input: {
  jobId: string;
}): Promise<QueueAdminActionResult> {
  return withServerActionGuard("queueAdmin.cancelQueuedJob", async () => {
    const gate = await requireAdminActor();
    if (gate.error || !gate.actor) return { ok: false, error: gate.error, errorKind: "auth" };
    if (!isUuid(input.jobId)) {
      return { ok: false, error: "Geçersiz job id.", errorKind: "validation" };
    }
    const admin = createSupabaseAdminClient();
    const { job, error } = await fetchJob(admin, input.jobId);
    if (error) return { ok: false, error, errorKind: "fetch" };
    if (!job) return { ok: false, error: "Job bulunamadı.", errorKind: "validation" };
    if (!canAccessJobOrg({ actorOrgId: gate.actor.organizationId, actorRole: gate.actor.role, jobOrgId: job.organization_id })) {
      return { ok: false, error: "Bu job için yetkiniz yok.", errorKind: "permission" };
    }
    if (job.status !== "queued") {
      return { ok: false, error: "Yalnızca queued job iptal edilebilir.", errorKind: "validation" };
    }
    if (job.pgmq_msg_id != null) {
      const { error: delErr } = await admin.rpc("peaker_pgmq_delete", {
        p_queue_name: MAIN_QUEUE,
        p_msg_id: job.pgmq_msg_id,
      });
      if (delErr) {
        logger.warn("queueAdmin.cancel", "pgmq_delete failed (continuing finalize)", {
          jobId: job.id,
          reason: delErr.message,
        });
      }
    }
    const { error: finErr } = await admin.rpc("peaker_jobs_finalize", {
      p_log_id: job.id,
      p_status: "cancelled",
      p_result: null,
      p_error_kind: "cancelled",
      p_error_message: "Cancelled via sistem operasyonları paneli",
      p_next_run_at: null,
    });
    if (finErr) return { ok: false, error: finErr.message, errorKind: "fetch" };

    await logAuditEvent({
      organizationId: job.organization_id,
      actorUserId: gate.actor.id,
      actorRole: gate.actor.role,
      action: "job.queue.cancel",
      entityType: "async_job",
      entityId: job.id,
      metadata: { jobKind: job.job_kind },
    });
    await appendOperationalTimeline(admin, {
      organizationId: job.organization_id,
      eventType: "queue.job.cancel",
      severity: "info",
      summary: `Queued job cancelled: ${job.job_kind}`,
      payload: { jobId: job.id },
      actorUserId: gate.actor.id,
    });
    return { ok: true };
  });
}

export async function queueAdminPurgeCompleted(input: {
  organizationId?: string | null;
  olderThanDays?: number;
}): Promise<QueueAdminActionResult<{ deleted: number }>> {
  return withServerActionGuard("queueAdmin.purgeCompleted", async () => {
    const gate = await requireAdminActor();
    if (gate.error || !gate.actor) return { ok: false, error: gate.error, errorKind: "auth" };
    const orgId = effectiveOrgIdForBulk({
      actorRole: gate.actor.role,
      actorOrgId: gate.actor.organizationId,
      requestedOrgId: input.organizationId,
    });
    if (!orgId || !isUuid(orgId)) {
      return { ok: false, error: "Geçerli organizationId gerekli.", errorKind: "validation" };
    }
    const days = Math.min(365, Math.max(7, Math.floor(input.olderThanDays ?? 30)));
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("peaker_jobs_purge_completed_for_org", {
      p_organization_id: orgId,
      p_older_than_days: days,
    });
    if (error) return { ok: false, error: error.message, errorKind: "fetch" };
    const deleted = typeof data === "number" ? data : Number(data) || 0;

    await logAuditEvent({
      organizationId: orgId,
      actorUserId: gate.actor.id,
      actorRole: gate.actor.role,
      action: "job.queue.purge_completed",
      entityType: "async_job",
      entityId: orgId,
      metadata: { deleted, olderThanDays: days },
    });
    await appendOperationalTimeline(admin, {
      organizationId: orgId,
      eventType: "queue.purge_completed",
      severity: "info",
      summary: `Purge completed jobs: ${deleted} rows (>${days}d)`,
      payload: { deleted, olderThanDays: days },
      actorUserId: gate.actor.id,
    });
    return { ok: true, deleted };
  });
}
