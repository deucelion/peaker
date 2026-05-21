/**
 * Faz 12.1 — pgmq consumer worker loop.
 *
 * Çağrılış noktaları:
 *   1. `POST /api/jobs/process` route handler (Vercel Cron veya pg_cron+pg_net).
 *   2. CLI script (lokal geliştirme: `tsx src/lib/jobs/worker-cli.ts`).
 *
 * Tek tick davranışı:
 *   - `pgmq.read(qty=BATCH, vt=VT_SEC)` ile batch al.
 *   - Her mesaj için:
 *       a) `peaker_jobs_lookup_by_msg(msg_id)` ile log row resolve.
 *       b) Cancellation kontrolü (idempotency_key → peaker_jobs_cancellations).
 *       c) `peaker_jobs_mark_running(log_id)` atomic transition (duplicate guard).
 *       d) Registry'den handler çöz; yoksa error_kind='unsupported_kind' DLQ.
 *       e) Handler.run(ctx) — başarı → finalize(succeeded) + pgmq.delete.
 *       f) Hata → decideRetry kararıyla:
 *            - retry: pgmq.set_vt(exponential backoff), log status=queued.
 *            - no-retry / max_attempts: pgmq.send(DLQ payload) + pgmq.delete +
 *              log status=dead_letter.
 *   - Faz 13.1 — Tick başında `peaker_jobs_rescue_stuck` ile stuck `running`
 *     job'ları requeue / dead_letter finalize.
 *   - Heartbeat: tick sonunda `peaker_worker_heartbeat` insert (rescue metrikleri
 *     + retry storm flag).
 *
 * Crash safety:
 *   - Visibility timeout süresince mesaj başka worker tarafından alınmaz.
 *   - VT içinde processing tamamlanmazsa mesaj otomatik visible olur.
 *   - mark_running idempotent; duplicate worker'lar status='running' görür ve atlar.
 *
 * Graceful shutdown:
 *   - Worker max çalışma süresi `softDeadlineMs`. Aşılırsa loop kırılır;
 *     kalan mesajlar bir sonraki tick'te alınır.
 */

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/monitoring/logger";
import {
  recordRetryAttempt,
  reportQueueLatency,
  reportWorkerDuration,
} from "@/lib/monitoring/advancedTelemetry";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runReceivableReminderSweepIfDue } from "@/lib/finance/receivableReminderSweep";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import { runStuckJobRescue } from "./rescueStuckJobs";
import { decideRetry } from "./queueAdapter";
import { getHandler, listSupportedKinds } from "./handlers/registry";
import type { WorkerJobContext } from "./handlers/types";
import type { JobKind } from "./jobTypes";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_VISIBILITY_SECONDS = 60;
const DEFAULT_SOFT_DEADLINE_MS = 50_000;
const DEFAULT_BASE_BACKOFF_MS = 5_000;
const QUEUE_NAME = "peaker_jobs";
const DLQ_NAME = "peaker_jobs_dlq";

export type WorkerTickOptions = {
  batchSize?: number;
  visibilitySeconds?: number;
  softDeadlineMs?: number;
  baseBackoffMs?: number;
  workerId?: string;
  source?: "vercel_cron" | "pg_cron" | "manual" | "test";
  /** Faz 13.1 — Stuck `running` eşiği (saniye). Default 600. */
  rescueAfterSeconds?: number;
};

export type WorkerTickResult = {
  workerId: string;
  source: string;
  batchSize: number;
  processed: number;
  succeeded: number;
  failed: number;
  deadLetter: number;
  skippedCancelled: number;
  skippedUnsupported: number;
  durationMs: number;
  pgmqAvailable: boolean;
  reason?: string;
  rescueRescued?: number;
  rescueDeadStuck?: number;
  retryStormDetected?: boolean;
};

type PgmqMessage = {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: Record<string, unknown> | null;
};

type JobsLookupRow = {
  log_id: string;
  job_kind: string;
  organization_id: string | null;
  idempotency_key: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown> | null;
};

type MarkRunningRow = {
  log_id: string | null;
  status: string;
  attempts: number;
  proceed: boolean;
};

async function pgmqRead(
  adminClient: SupabaseClient,
  visibilitySeconds: number,
  batchSize: number
): Promise<{ ok: true; messages: PgmqMessage[] } | { ok: false; reason: string }> {
  try {
    const { data, error } = await adminClient.rpc("peaker_pgmq_read", {
      p_queue_name: QUEUE_NAME,
      p_visibility_seconds: visibilitySeconds,
      p_batch_size: batchSize,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true, messages: (data ?? []) as PgmqMessage[] };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

async function pgmqDelete(
  adminClient: SupabaseClient,
  msgId: number
): Promise<void> {
  try {
    await adminClient.rpc("peaker_pgmq_delete", {
      p_queue_name: QUEUE_NAME,
      p_msg_id: msgId,
    });
  } catch (err) {
    logger.warn("worker.pgmq", "delete failed", {
      msgId,
      reason: (err as Error).message,
    });
  }
}

async function pgmqSetVt(
  adminClient: SupabaseClient,
  msgId: number,
  visibilitySeconds: number
): Promise<void> {
  try {
    await adminClient.rpc("peaker_pgmq_set_vt", {
      p_queue_name: QUEUE_NAME,
      p_msg_id: msgId,
      p_visibility_seconds: visibilitySeconds,
    });
  } catch (err) {
    logger.warn("worker.pgmq", "set_vt failed", {
      msgId,
      reason: (err as Error).message,
    });
  }
}

async function pgmqSendDlq(
  adminClient: SupabaseClient,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await adminClient.rpc("peaker_pgmq_send", {
      p_queue_name: DLQ_NAME,
      p_payload: payload,
    });
  } catch (err) {
    logger.warn("worker.pgmq", "DLQ send failed", {
      reason: (err as Error).message,
    });
  }
}

async function lookupLogByMsg(
  adminClient: SupabaseClient,
  msgId: number
): Promise<JobsLookupRow | null> {
  try {
    const { data, error } = await adminClient.rpc("peaker_jobs_lookup_by_msg", {
      p_msg_id: msgId,
    });
    if (error) return null;
    if (Array.isArray(data) && data.length > 0) return data[0] as JobsLookupRow;
    return null;
  } catch {
    return null;
  }
}

async function markRunning(
  adminClient: SupabaseClient,
  logId: string
): Promise<MarkRunningRow | null> {
  try {
    const { data, error } = await adminClient.rpc("peaker_jobs_mark_running", {
      p_log_id: logId,
    });
    if (error) return null;
    if (Array.isArray(data) && data.length > 0) return data[0] as MarkRunningRow;
    return null;
  } catch {
    return null;
  }
}

async function finalizeJob(
  adminClient: SupabaseClient,
  logId: string,
  status: "succeeded" | "failed" | "dead_letter" | "cancelled",
  options: {
    result?: Record<string, unknown> | null;
    errorKind?: string | null;
    errorMessage?: string | null;
    nextRunAt?: string | null;
  } = {}
): Promise<void> {
  try {
    await adminClient.rpc("peaker_jobs_finalize", {
      p_log_id: logId,
      p_status: status,
      p_result: options.result ?? null,
      p_error_kind: options.errorKind ?? null,
      p_error_message: options.errorMessage ?? null,
      p_next_run_at: options.nextRunAt ?? null,
    });
  } catch (err) {
    logger.warn("worker.finalize", "finalize failed", {
      logId,
      status,
      reason: (err as Error).message,
    });
  }
}

async function isCancelled(
  adminClient: SupabaseClient,
  idempotencyKey: string | null
): Promise<boolean> {
  if (!idempotencyKey) return false;
  try {
    const { data, error } = await adminClient
      .from("peaker_jobs_cancellations")
      .select("cancellation_key")
      .eq("cancellation_key", idempotencyKey)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

type HeartbeatMetrics = {
  processed: number;
  succeeded: number;
  failed: number;
  deadLetter: number;
  skippedCancelled: number;
  skippedUnsupported: number;
  durationMs: number;
  rescueRescued?: number;
  rescueDeadStuck?: number;
  retryStormDetected?: boolean;
};

async function emitHeartbeat(
  adminClient: SupabaseClient,
  workerId: string,
  source: string,
  batchSize: number,
  metrics: HeartbeatMetrics
): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      worker_id: workerId,
      ticked_at: new Date().toISOString(),
      batch_size: batchSize,
      processed_count: metrics.processed,
      succeeded_count: metrics.succeeded,
      failed_count: metrics.failed,
      dead_letter_count: metrics.deadLetter,
      duration_ms: metrics.durationMs,
      source,
    };
    if (metrics.rescueRescued != null) row.rescue_rescued_count = metrics.rescueRescued;
    if (metrics.rescueDeadStuck != null) row.rescue_dead_stuck_count = metrics.rescueDeadStuck;
    if (metrics.retryStormDetected != null) row.retry_storm_detected = metrics.retryStormDetected;
    await adminClient.from("peaker_worker_heartbeat").insert(row);
  } catch (err) {
    logger.warn("worker.heartbeat", "insert failed (non-fatal)", {
      workerId,
      reason: (err as Error).message,
    });
  }
}

/**
 * Worker'ın tek tick'i. Vercel cron veya pg_cron her dakika tetiklerse,
 * bu fonksiyon tek seferde DEFAULT_BATCH_SIZE kadar mesajı işler.
 */
export async function runWorkerTick(options: WorkerTickOptions = {}): Promise<WorkerTickResult> {
  const batchSize = Math.max(1, Math.min(50, options.batchSize ?? DEFAULT_BATCH_SIZE));
  const visibilitySeconds = options.visibilitySeconds ?? DEFAULT_VISIBILITY_SECONDS;
  const softDeadlineMs = options.softDeadlineMs ?? DEFAULT_SOFT_DEADLINE_MS;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const workerId = options.workerId ?? `worker-${randomUUID().slice(0, 8)}`;
  const source = options.source ?? "manual";
  const supported = new Set(listSupportedKinds());

  const startedAt = Date.now();
  const adminClient = createSupabaseAdminClient();

  const rescue = await runStuckJobRescue(adminClient, options.rescueAfterSeconds ?? 600);
  if (!rescue.error && (rescue.rescued > 0 || rescue.deadStuck > 0)) {
    await appendOperationalTimeline(adminClient, {
      organizationId: null,
      eventType: "worker.stuck_rescue",
      severity: rescue.deadStuck > 0 ? "warning" : "info",
      summary: `Stuck job rescue: ${rescue.rescued} requeued, ${rescue.deadStuck} finalized as dead`,
      payload: { rescued: rescue.rescued, deadStuck: rescue.deadStuck, workerId },
    });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLetter = 0;
  let skippedCancelled = 0;
  let skippedUnsupported = 0;
  let pgmqAvailable = false;
  let reason: string | undefined;
  let retryStormDetected = false;

  const buildResult = (): WorkerTickResult => ({
    workerId,
    source,
    batchSize,
    processed,
    succeeded,
    failed,
    deadLetter,
    skippedCancelled,
    skippedUnsupported,
    durationMs: Date.now() - startedAt,
    pgmqAvailable,
    reason,
    rescueRescued: rescue.rescued,
    rescueDeadStuck: rescue.deadStuck,
    retryStormDetected,
  });

  const heartbeatMetrics = (): HeartbeatMetrics => ({
    processed,
    succeeded,
    failed,
    deadLetter,
    skippedCancelled,
    skippedUnsupported,
    durationMs: Date.now() - startedAt,
    rescueRescued: rescue.rescued,
    rescueDeadStuck: rescue.deadStuck,
    retryStormDetected,
  });

  try {
    const readResult = await pgmqRead(adminClient, visibilitySeconds, batchSize);
    if (!readResult.ok) {
      logger.warn("worker.tick", "pgmq.read failed", {
        workerId,
        reason: readResult.reason,
      });
      reason = readResult.reason;
      return buildResult();
    }

    pgmqAvailable = true;
    const messages = readResult.messages;
    if (messages.length === 0) {
      logger.debug("worker.tick", "no messages", { workerId });
      return buildResult();
    }

    for (const msg of messages) {
      if (Date.now() - startedAt > softDeadlineMs) {
        logger.warn("worker.tick", "soft deadline reached; aborting batch", {
          workerId,
          remaining: messages.length - processed,
        });
        break;
      }

      processed += 1;
      const log = await lookupLogByMsg(adminClient, msg.msg_id);
      if (!log) {
        logger.warn("worker.tick", "no log row for msg; discarding", {
          workerId,
          msgId: msg.msg_id,
        });
        await pgmqDelete(adminClient, msg.msg_id);
        continue;
      }

      const cancelled = await isCancelled(adminClient, log.idempotency_key);
      if (cancelled) {
        skippedCancelled += 1;
        await finalizeJob(adminClient, log.log_id, "cancelled", {
          errorKind: "cancelled",
          errorMessage: "Job cancelled by user",
        });
        await pgmqDelete(adminClient, msg.msg_id);
        continue;
      }

      if (!supported.has(log.job_kind as JobKind)) {
        skippedUnsupported += 1;
        logger.warn("worker.tick", "unsupported job_kind; routing to DLQ", {
          workerId,
          jobKind: log.job_kind,
          logId: log.log_id,
        });
        await pgmqSendDlq(adminClient, {
          reason: "unsupported_kind",
          originalKind: log.job_kind,
          logId: log.log_id,
          payload: log.payload,
          enqueuedAt: msg.enqueued_at,
        });
        await finalizeJob(adminClient, log.log_id, "dead_letter", {
          errorKind: "unsupported_kind",
          errorMessage: `Worker'da handler kaydı yok: ${log.job_kind}`,
        });
        await pgmqDelete(adminClient, msg.msg_id);
        deadLetter += 1;
        continue;
      }

      const transition = await markRunning(adminClient, log.log_id);
      if (!transition || !transition.proceed) {
        logger.warn("worker.lock.skip", "mark_running did not proceed; possible duplicate or stale message", {
          workerId,
          logId: log.log_id,
          msgId: msg.msg_id,
          currentStatus: transition?.status,
        });
        await pgmqDelete(adminClient, msg.msg_id);
        continue;
      }

      const handler = getHandler(log.job_kind as JobKind);
      if (!handler) {
        skippedUnsupported += 1;
        await finalizeJob(adminClient, log.log_id, "dead_letter", {
          errorKind: "unsupported_kind",
          errorMessage: `Handler bulunamadı: ${log.job_kind}`,
        });
        await pgmqDelete(adminClient, msg.msg_id);
        deadLetter += 1;
        continue;
      }

      const ctx: WorkerJobContext = {
        jobKind: log.job_kind as JobKind,
        logId: log.log_id,
        attempts: transition.attempts,
        maxAttempts: log.max_attempts,
        organizationId: log.organization_id,
        idempotencyKey: log.idempotency_key,
        payload: log.payload ?? {},
        workerId,
        visibilityDeadline: Date.now() + visibilitySeconds * 1000,
      };

      const handlerStartedAt = Date.now();
      reportQueueLatency({
        jobKind: log.job_kind,
        queueName: QUEUE_NAME,
        organizationId: log.organization_id,
        enqueuedAt: msg.enqueued_at,
        startedAt: new Date(handlerStartedAt),
      });
      try {
        const result = await handler.run(ctx);
        const handlerDurationMs = Date.now() - handlerStartedAt;
        await finalizeJob(adminClient, log.log_id, "succeeded", {
          result: {
            ...result,
            durationMs: handlerDurationMs,
            workerId,
          } as unknown as Record<string, unknown>,
        });
        await pgmqDelete(adminClient, msg.msg_id);
        succeeded += 1;
        logger.info("worker.tick", "job succeeded", {
          workerId,
          logId: log.log_id,
          jobKind: log.job_kind,
          attempts: transition.attempts,
          durationMs: handlerDurationMs,
        });
        reportWorkerDuration({
          jobKind: log.job_kind,
          organizationId: log.organization_id,
          durationMs: handlerDurationMs,
          status: "succeeded",
          attempts: transition.attempts,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const errorKind =
          (error as Error & { errorKind?: string }).errorKind ?? "fetch_error";
        const decision = decideRetry(errorKind, {
          attempt: transition.attempts,
          maxAttempts: log.max_attempts,
          baseBackoffMs,
        });

        if (decision.shouldRetry && decision.nextDelayMs) {
          await pgmqSetVt(
            adminClient,
            msg.msg_id,
            Math.max(visibilitySeconds, Math.ceil(decision.nextDelayMs / 1000))
          );
          await finalizeJob(adminClient, log.log_id, "failed", {
            errorKind,
            errorMessage: error.message,
            nextRunAt: new Date(Date.now() + decision.nextDelayMs).toISOString(),
          });
          try {
            await adminClient
              .from("peaker_jobs_log")
              .update({ status: "queued" })
              .eq("id", log.log_id);
          } catch {
            // best-effort
          }
          failed += 1;
          logger.warn("worker.tick", "job failed; scheduled retry", {
            workerId,
            logId: log.log_id,
            jobKind: log.job_kind,
            attempts: transition.attempts,
            maxAttempts: log.max_attempts,
            nextDelayMs: decision.nextDelayMs,
            errorKind,
            error: error.message,
          });
          reportWorkerDuration({
            jobKind: log.job_kind,
            organizationId: log.organization_id,
            durationMs: Date.now() - handlerStartedAt,
            status: "failed",
            attempts: transition.attempts,
          });
          if (recordRetryAttempt({ jobKind: log.job_kind, attempt: transition.attempts })) {
            retryStormDetected = true;
          }
        } else {
          await pgmqSendDlq(adminClient, {
            reason: decision.reason ?? "no_retry_or_max_attempts",
            originalKind: log.job_kind,
            logId: log.log_id,
            payload: log.payload,
            attempts: transition.attempts,
            maxAttempts: log.max_attempts,
            enqueuedAt: msg.enqueued_at,
            lastError: error.message,
            errorKind,
          });
          await finalizeJob(adminClient, log.log_id, "dead_letter", {
            errorKind,
            errorMessage: error.message,
          });
          await pgmqDelete(adminClient, msg.msg_id);
          deadLetter += 1;
          logger.error("worker.tick", error, {
            workerId,
            logId: log.log_id,
            jobKind: log.job_kind,
            attempts: transition.attempts,
            routedTo: "DLQ",
            errorKind,
          });
          reportWorkerDuration({
            jobKind: log.job_kind,
            organizationId: log.organization_id,
            durationMs: Date.now() - handlerStartedAt,
            status: "dead_letter",
            attempts: transition.attempts,
          });
        }
      }
    }

    const out = buildResult();
    logger.info("worker.tick", "tick complete", { ...out });
    return out;
  } finally {
    try {
      await runReceivableReminderSweepIfDue();
    } catch (e) {
      logger.warn("worker.tick", "receivable reminder sweep skipped", {
        reason: e instanceof Error ? e.message : String(e),
      });
    }
    await emitHeartbeat(adminClient, workerId, source, batchSize, heartbeatMetrics());
  }
}
