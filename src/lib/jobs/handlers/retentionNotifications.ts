/**
 * Faz 12.1 — `retention.notifications` worker handler.
 *
 * Davranış parity:
 *   - Mevcut `runNotificationsRetention` helper'ını çağırır (Faz 7.5).
 *   - Sonuç: { deletedCount, retentionDays, durationMs }.
 *
 * Idempotency:
 *   - RPC `cleanup_read_notifications` her çağrıda silinebilecek olanı siler;
 *     duplicate execution toplam silimde fark yaratmaz (zaten silinmiş satırlar
 *     "okundu ve eski" filtresine takılmaz).
 *
 * Backward compatibility:
 *   - sync `runJob` çağrısı (mevcut admin paneli) korunur; async handler
 *     opsiyonel.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runNotificationsRetention } from "@/lib/monitoring";
import type { WorkerHandler, WorkerHandlerResult, WorkerJobContext } from "./types";

const DEFAULT_RETENTION_DAYS = 90;

export const retentionNotificationsHandler: WorkerHandler = {
  kind: "retention.notifications",
  async run(ctx: WorkerJobContext): Promise<WorkerHandlerResult> {
    const requestedDays = Number((ctx.payload?.attributes as Record<string, unknown> | undefined)?.retentionDays);
    const retentionDays = Number.isFinite(requestedDays) && requestedDays >= 30
      ? Math.floor(requestedDays)
      : DEFAULT_RETENTION_DAYS;

    const adminClient = createSupabaseAdminClient();
    const result = await runNotificationsRetention(adminClient, retentionDays);
    if (!result.ok) {
      const err = new Error(result.error || "retention.notifications failed");
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
