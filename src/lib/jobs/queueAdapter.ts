/**
 * Faz 10.2 — Async queue adapter interface.
 *
 * Şu an `runJob` synchronous; bu modül gelecekteki gerçek queue
 * (pgmq, Inngest, Trigger.dev, BullMQ) için adapter sözleşmesini tanımlar.
 *
 * Karar (Faz 10): **pgmq** seçildi.
 *  - Tek altyapı (Supabase + pg_cron + pgmq)
 *  - Serverless'ta worker zorunluluğu yok (cron consumer)
 *  - Faz 11'de adapter switch ile başka teknolojiye taşınabilir
 *
 * Bu turda gerçek queue aktive değil; sadece interface + queue-ready
 * JobContext metadata. Adapter `inMemoryAdapter` ile mevcut davranış
 * korunur.
 */

import type { JobContext, JobKind } from "./jobTypes";

export type QueueJobPayload = {
  kind: JobKind;
  /** Idempotency key — aynı key tekrar enqueue edilirse adapter no-op döner. */
  idempotencyKey?: string;
  /** Job verisi (JSON-serializable). */
  payload: Record<string, unknown>;
  /** Retry stratejisi. */
  retry?: {
    maxAttempts: number;
    /** ms cinsinden backoff (linear veya exponential adapter'a göre). */
    backoffMs: number;
  };
  /** Dead-letter queue'ya gitmeden önce kaç başarısızlık olmalı. */
  deadLetterThreshold?: number;
  /** Cancellation token (adapter desteklerse). */
  cancellationKey?: string;
};

export type QueueEnqueueResult =
  | { status: "enqueued"; jobId: string }
  | { status: "duplicate"; jobId: string }
  | { status: "rejected"; reason: string };

export type QueueCancelResult =
  | { status: "cancelled"; jobId: string }
  | { status: "not_found" }
  | { status: "already_finished" };

export interface QueueAdapter {
  readonly name: string;
  enqueue(payload: QueueJobPayload): Promise<QueueEnqueueResult>;
  cancel(cancellationKey: string): Promise<QueueCancelResult>;
  /** Adapter destekliyorsa job durumu sorgular. */
  status?(jobId: string): Promise<{ jobId: string; status: string; attempts: number } | null>;
}

/**
 * In-memory adapter — gerçek queue yok. Hemen "enqueued" döner ama
 * iş yapılmaz. Bu placeholder mevcut `runJob` semantiğini korur.
 * Production'da gerçek pgmq adapter'ı ile değiştirilir.
 */
export const inMemoryAdapter: QueueAdapter = {
  name: "in-memory",
  async enqueue(payload) {
    const jobId =
      payload.idempotencyKey ||
      (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    return { status: "enqueued", jobId };
  },
  async cancel() {
    return { status: "not_found" };
  },
};

/**
 * Adapter registry — production'da gerçek adapter `registerQueueAdapter` ile
 * set edilir. Default: in-memory.
 */
let activeAdapter: QueueAdapter = inMemoryAdapter;

export function registerQueueAdapter(adapter: QueueAdapter): void {
  activeAdapter = adapter;
}

export function getQueueAdapter(): QueueAdapter {
  return activeAdapter;
}

/**
 * Queue-ready JobContext metadata. Mevcut `JobContext`'i genişletmeden
 * job'ın queue payload'ına dönüştürülmesi için yardımcı.
 */
export function jobContextToQueuePayload(
  ctx: JobContext,
  options?: { retry?: QueueJobPayload["retry"]; deadLetterThreshold?: number; cancellationKey?: string }
): QueueJobPayload {
  return {
    kind: ctx.kind,
    idempotencyKey: ctx.jobId,
    payload: {
      initiator: ctx.initiator,
      organizationId: ctx.organizationId ?? null,
      attributes: ctx.attributes,
      startedAt: ctx.startedAt,
    },
    retry: options?.retry,
    deadLetterThreshold: options?.deadLetterThreshold,
    cancellationKey: options?.cancellationKey,
  };
}

/**
 * Mevcut `runJob` synchronous; adapter abstraction yalnızca metadata seviyesinde
 * hazır. Gelecekte `runJobOrEnqueue` aşağıdaki gibi çalışacak:
 *
 *   async function runJobOrEnqueue(ctx, work, options) {
 *     if (options?.async) {
 *       const result = await getQueueAdapter().enqueue(jobContextToQueuePayload(ctx, options));
 *       return { jobId: result.jobId, status: "queued" };
 *     }
 *     return runJob(ctx, work);
 *   }
 *
 * Bu turda bu fonksiyonu eklemiyoruz; mevcut `runJob` ile çakışma riskini
 * önlemek için. Faz 11'de aktif edilir.
 */
export type JobRetryClassification = "no_retry" | "retry_safe" | "retry_idempotent_only";

export type JobRetryDecision = {
  shouldRetry: boolean;
  reason?: string;
  nextDelayMs?: number;
};

/**
 * Faz 10.7 hata kindlerini queue retry kararına çevirir.
 */
export function decideRetry(
  errorKind: string | undefined,
  meta: { attempt: number; maxAttempts: number; baseBackoffMs: number }
): JobRetryDecision {
  const classification: JobRetryClassification =
    errorKind === "transient_fetch"
      ? "retry_safe"
      : errorKind === "fetch_error"
        ? "retry_idempotent_only"
        : "no_retry";
  if (classification === "no_retry") {
    return { shouldRetry: false, reason: "non-retryable error kind" };
  }
  if (meta.attempt >= meta.maxAttempts) {
    return { shouldRetry: false, reason: "max attempts reached" };
  }
  return {
    shouldRetry: true,
    nextDelayMs: meta.baseBackoffMs * Math.pow(2, Math.max(0, meta.attempt - 1)),
  };
}
