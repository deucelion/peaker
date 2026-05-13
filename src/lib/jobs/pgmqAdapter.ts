/**
 * Faz 11.1 — pgmq-backed queue adapter.
 *
 * - Producer: `enqueue` → `peaker_enqueue_job` RPC.
 * - Bookkeeping: `peaker_jobs_log` tablosu.
 * - Cancellation: `peaker_cancel_job` RPC.
 *
 * Backward-compatible:
 *   - RPC bulunamazsa (migration uygulanmamış) adapter `rejected` döner;
 *     caller `runJob` fallback ile senkron çalışır.
 *   - pgmq extension yoksa migration RPC'si `pgmq_msg_id=null` döndürür;
 *     consumer Faz 12'de devreye girer.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/monitoring/logger";
import type {
  QueueAdapter,
  QueueCancelResult,
  QueueEnqueueResult,
  QueueJobPayload,
} from "./queueAdapter";

type EnqueueResultRow = {
  log_id: string;
  status: "queued" | "duplicate";
  pgmq_msg_id: number | null;
};

export function createPgmqAdapter(): QueueAdapter {
  return {
    name: "pgmq",
    async enqueue(payload: QueueJobPayload): Promise<QueueEnqueueResult> {
      const adminClient = createSupabaseAdminClient();
      try {
        const { data, error } = await adminClient.rpc("peaker_enqueue_job", {
          p_job_kind: payload.kind,
          p_organization_id:
            (payload.payload.organizationId as string | null | undefined) ?? null,
          p_payload: payload.payload as unknown as Record<string, unknown>,
          p_idempotency_key: payload.idempotencyKey ?? null,
          p_max_attempts: payload.retry?.maxAttempts ?? 5,
          p_initiator_kind:
            (payload.payload.initiator as { kind?: string } | undefined)?.kind ??
            "user",
          p_initiator_id:
            (payload.payload.initiator as { id?: string } | undefined)?.id ??
            null,
        });
        if (error) {
          logger.warn("queue.pgmq", "enqueue rpc failed", {
            kind: payload.kind,
            error: error.message,
          });
          return { status: "rejected", reason: error.message };
        }
        const row = Array.isArray(data) ? (data[0] as EnqueueResultRow | undefined) : (data as EnqueueResultRow | null);
        if (!row) {
          return { status: "rejected", reason: "enqueue rpc returned empty result" };
        }
        if (row.status === "duplicate") {
          return { status: "duplicate", jobId: row.log_id };
        }
        return { status: "enqueued", jobId: row.log_id };
      } catch (err) {
        logger.warn("queue.pgmq", "enqueue threw", {
          kind: payload.kind,
          error: (err as Error).message,
        });
        return { status: "rejected", reason: (err as Error).message };
      }
    },
    async cancel(cancellationKey: string): Promise<QueueCancelResult> {
      const adminClient = createSupabaseAdminClient();
      try {
        const { error } = await adminClient.rpc("peaker_cancel_job", {
          p_cancellation_key: cancellationKey,
          p_reason: "Cancelled via adapter",
        });
        if (error) {
          logger.warn("queue.pgmq", "cancel rpc failed", {
            cancellationKey,
            error: error.message,
          });
          return { status: "not_found" };
        }
        return { status: "cancelled", jobId: cancellationKey };
      } catch (err) {
        logger.warn("queue.pgmq", "cancel threw", { error: (err as Error).message });
        return { status: "not_found" };
      }
    },
    async status(jobId: string) {
      const adminClient = createSupabaseAdminClient();
      try {
        const { data, error } = await adminClient
          .from("peaker_jobs_log")
          .select("id, status, attempts")
          .eq("id", jobId)
          .maybeSingle();
        if (error || !data) return null;
        return { jobId: data.id, status: data.status, attempts: data.attempts ?? 0 };
      } catch {
        return null;
      }
    },
  };
}
