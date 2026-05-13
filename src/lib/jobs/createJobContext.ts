/**
 * Faz 8.2 — Job context factory + runner.
 *
 * Henüz gerçek queue yok. `runJob` senkron çalışır ama telemetry, hata
 * yakalama ve durum izleme ile sarmalanır. Action'lar bu wrapper'ı
 * adapt ederek ileride queue'ya geçebilir.
 */

import { randomUUID } from "node:crypto";
import { logger } from "@/lib/monitoring/logger";
import type { JobContext, JobInitiator, JobKind, JobResult } from "./jobTypes";

export function createJobContext(input: {
  kind: JobKind;
  initiator: JobInitiator;
  organizationId?: string | null;
  attributes?: Record<string, unknown>;
}): JobContext {
  return {
    kind: input.kind,
    jobId: randomUUID(),
    initiator: input.initiator,
    organizationId: input.organizationId ?? null,
    startedAt: Date.now(),
    attributes: { ...(input.attributes ?? {}) },
  };
}

export type JobRunOutcome<T> = {
  data?: T;
  /** Cap aşılmışsa job sonucu `truncated` döner. */
  truncated?: boolean;
  cap?: number;
  rowCount?: number;
  /** İşletmesel "soft error" (kullanıcı görür ama runtime hatası değildir). */
  softError?: string;
};

/**
 * Job runner. Foundation seviyesinde — senkron, ama telemetry üretir.
 *
 * Kullanım:
 *   const result = await runJob(ctx, async (job) => {
 *     job.attributes.rowsScanned = 1234;
 *     return { data: csv, rowCount: 1234 };
 *   });
 */
export async function runJob<T>(
  ctx: JobContext,
  fn: (ctx: JobContext) => Promise<JobRunOutcome<T>>
): Promise<JobResult<T>> {
  const logScope = `job.${ctx.kind}`;
  logger.info(logScope, "job started", {
    jobId: ctx.jobId,
    organizationId: ctx.organizationId,
    initiatorKind: ctx.initiator.kind,
  });

  try {
    const outcome = await fn(ctx);
    const durationMs = Date.now() - ctx.startedAt;
    const status = outcome.softError
      ? "failed"
      : outcome.truncated
        ? "truncated"
        : "succeeded";
    const result: JobResult<T> = {
      jobId: ctx.jobId,
      kind: ctx.kind,
      status,
      durationMs,
      data: outcome.data,
      rowCount: outcome.rowCount,
      truncated: outcome.truncated,
      cap: outcome.cap,
      error: outcome.softError,
      attributes: { ...ctx.attributes },
    };
    if (status === "failed") {
      logger.warn(logScope, "job failed (soft)", {
        jobId: ctx.jobId,
        durationMs,
        rowCount: outcome.rowCount,
        truncated: outcome.truncated,
        error: outcome.softError,
      });
    } else if (status === "truncated") {
      logger.warn(logScope, "job truncated", {
        jobId: ctx.jobId,
        durationMs,
        rowCount: outcome.rowCount,
        cap: outcome.cap,
      });
    } else {
      logger.info(logScope, "job succeeded", {
        jobId: ctx.jobId,
        durationMs,
        rowCount: outcome.rowCount,
      });
    }
    return result;
  } catch (err) {
    const durationMs = Date.now() - ctx.startedAt;
    logger.error(logScope, err, {
      jobId: ctx.jobId,
      durationMs,
      organizationId: ctx.organizationId,
    });
    return {
      jobId: ctx.jobId,
      kind: ctx.kind,
      status: "failed",
      durationMs,
      error: err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      attributes: { ...ctx.attributes },
    };
  }
}
