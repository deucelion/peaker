/**
 * Faz 12.6 — `retention.jobs` worker handler.
 *
 * Çağırdığı RPC: `peaker_cleanup_jobs_retention(terminal, failed, heartbeat, archive)`
 *
 * Davranış:
 *   - Çağrılan payload `attributes` içinde override değerleri varsa kullanır.
 *   - Yoksa default'lar: 30 / 90 / 7 / 60 gün.
 *   - Sonuç: per-scope removed count + total.
 *
 * Idempotency:
 *   - RPC `delete ... where finished_at < now() - days` mantığı; tekrar
 *     çağrıldığında yalnızca yeni eskimiş satırları temizler.
 *
 * Worker source vs cron source:
 *   - pg_cron (peaker_jobs_retention) zaten günde bir kez RPC'yi doğrudan
 *     çağırıyor. Bu handler manuel tetikleme + admin panelinden tek-tıkla
 *     cleanup için.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runJobsRetention } from "@/lib/monitoring/jobsRetentionHealth";
import type { WorkerHandler, WorkerHandlerResult, WorkerJobContext } from "./types";

function pickNumber(attrs: Record<string, unknown> | undefined, key: string): number | undefined {
  const raw = attrs?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export const retentionJobsHandler: WorkerHandler = {
  kind: "retention.jobs",
  async run(ctx: WorkerJobContext): Promise<WorkerHandlerResult> {
    const attrs = ctx.payload?.attributes as Record<string, unknown> | undefined;
    const adminClient = createSupabaseAdminClient();
    const result = await runJobsRetention(adminClient, {
      terminalDays: pickNumber(attrs, "terminalDays"),
      failedDays: pickNumber(attrs, "failedDays"),
      heartbeatDays: pickNumber(attrs, "heartbeatDays"),
      archiveDays: pickNumber(attrs, "archiveDays"),
    });
    if (!result.ok) {
      const err = new Error(result.error || "retention.jobs failed");
      (err as Error & { errorKind?: string }).errorKind = "fetch_error";
      throw err;
    }
    return {
      summary: {
        removedByScope: result.removedByScope,
        durationMs: result.durationMs,
        totalRemoved: result.totals.totalRemoved,
        terminalDays: result.totals.terminalDays,
        failedDays: result.totals.failedDays,
        heartbeatDays: result.totals.heartbeatDays,
        archiveDays: result.totals.archiveDays,
      },
      rowCount: result.totals.totalRemoved,
    };
  },
};
