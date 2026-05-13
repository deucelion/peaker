/**
 * Faz 11.1 — Async job enqueue facade.
 *
 * Kullanım:
 *   const result = await enqueueJob(ctx, {
 *     retry: { maxAttempts: 3, backoffMs: 1000 },
 *     cancellationKey: `report:${reportId}`,
 *   });
 *
 * Davranış:
 *   - `getQueueAdapter()` ile aktif adapter alınır.
 *   - pgmq adapter yoksa veya `rejected` dönerse, caller `runJob` ile
 *     senkron çalıştırabilir (backward-compat).
 *   - `inMemoryAdapter` aktifse no-op enqueue yapılır (mevcut davranış).
 *
 * Telemetry:
 *   - Adapter tipi log'a yazılır.
 *   - Idempotency duplicate'leri info olarak loglanır.
 */

import { logger } from "@/lib/monitoring/logger";
import type { JobContext } from "./jobTypes";
import {
  getQueueAdapter,
  jobContextToQueuePayload,
  type QueueEnqueueResult,
  type QueueJobPayload,
} from "./queueAdapter";

export type EnqueueJobOptions = {
  retry?: QueueJobPayload["retry"];
  deadLetterThreshold?: number;
  cancellationKey?: string;
};

export async function enqueueJob(
  ctx: JobContext,
  options?: EnqueueJobOptions
): Promise<QueueEnqueueResult> {
  const adapter = getQueueAdapter();
  const payload = jobContextToQueuePayload(ctx, options);
  const result = await adapter.enqueue(payload);
  if (result.status === "duplicate") {
    logger.info("queue.enqueue", "duplicate job ignored", {
      adapter: adapter.name,
      kind: ctx.kind,
      jobId: result.jobId,
    });
  } else if (result.status === "rejected") {
    logger.warn("queue.enqueue", "rejected by adapter", {
      adapter: adapter.name,
      kind: ctx.kind,
      reason: result.reason,
    });
  } else {
    logger.info("queue.enqueue", "queued", {
      adapter: adapter.name,
      kind: ctx.kind,
      jobId: result.jobId,
    });
  }
  return result;
}
