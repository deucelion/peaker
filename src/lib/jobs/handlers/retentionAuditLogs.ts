/**
 * Faz 12.1 — `retention.auditLogs` worker handler.
 *
 * Parity: `runAuditLogsRetention` helper'ı çağrılır (Faz 7.5).
 * Idempotent: RPC silimi tekrar çalıştırıldığında zaten silinmiş satırlar
 * yine eski olduğu için yeniden hedef değildir.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runAuditLogsRetention } from "@/lib/monitoring";
import type { WorkerHandler, WorkerHandlerResult, WorkerJobContext } from "./types";

const DEFAULT_RETENTION_DAYS = 365;

export const retentionAuditLogsHandler: WorkerHandler = {
  kind: "retention.auditLogs",
  async run(ctx: WorkerJobContext): Promise<WorkerHandlerResult> {
    const requestedDays = Number((ctx.payload?.attributes as Record<string, unknown> | undefined)?.retentionDays);
    const retentionDays = Number.isFinite(requestedDays) && requestedDays >= 90
      ? Math.floor(requestedDays)
      : DEFAULT_RETENTION_DAYS;

    const adminClient = createSupabaseAdminClient();
    const result = await runAuditLogsRetention(adminClient, retentionDays);
    if (!result.ok) {
      const err = new Error(result.error || "retention.auditLogs failed");
      (err as Error & { errorKind?: string }).errorKind = "fetch_error";
      throw err;
    }
    return {
      summary: {
        deletedCount: result.deletedCount,
        retentionDays: result.retentionDays,
        durationMs: result.durationMs,
      },
      rowCount: result.deletedCount,
    };
  },
};
