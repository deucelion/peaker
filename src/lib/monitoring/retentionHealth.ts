/**
 * Faz 8.3 — Retention job health helpers.
 *
 * Hedef:
 *   - Faz 6'da eklenen `cleanup_read_notifications` ve `cleanup_audit_logs`
 *     RPC'lerini production-safe biçimde çağırmak.
 *   - Sonuçları structured log'a düşürmek.
 *   - Cron / scheduler entegrasyonu için interface (gerçek scheduler Faz 9).
 *
 * Cron strategy önerisi:
 *   1. Supabase pg_cron (recommended): `select cron.schedule(...)` ile
 *      `cleanup_read_notifications(90)` günde 1 kez.
 *   2. Alternatif: GitHub Actions schedule + service-role HTTP call.
 *   3. Alternatif: dış scheduler (Trigger.dev, Vercel Cron) bu helper'ı çağırır.
 *
 * Failure-safe:
 *   - RPC hata fırlatırsa swallow edilir; sonuç `{ ok: false, error }` döner.
 *   - Çağırıcı (cron job) retry policy uygular; bu helper retry yapmaz.
 */

import { logger } from "./logger";
import { startTiming } from "./timing";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetentionRunResult = {
  ok: boolean;
  scope: "notifications" | "audit_logs";
  retentionDays: number;
  deletedCount: number;
  durationMs: number;
  error?: string;
};

const NOTIFICATIONS_MIN_DAYS = 30;
const AUDIT_LOGS_MIN_DAYS = 90;

function clampRetention(days: number, min: number, fallback: number): number {
  if (!Number.isFinite(days)) return fallback;
  const v = Math.floor(days);
  return v < min ? fallback : v;
}

/**
 * Notifications retention cleanup.
 * RPC `cleanup_read_notifications(retention_days)` çağırır.
 */
export async function runNotificationsRetention(
  adminClient: SupabaseClient,
  retentionDays: number = 90
): Promise<RetentionRunResult> {
  const scope = "notifications" as const;
  const days = clampRetention(retentionDays, NOTIFICATIONS_MIN_DAYS, 90);
  const t = startTiming(`retention.${scope}`);
  try {
    const { data, error } = await adminClient.rpc("cleanup_read_notifications", {
      retention_days: days,
    });
    const durationMs = t.stop({ retentionDays: days });
    if (error) {
      logger.warn("retention.notifications.failed", error.message, { durationMs, retentionDays: days });
      return { ok: false, scope, retentionDays: days, deletedCount: 0, durationMs, error: error.message };
    }
    const deletedCount = extractDeletedCount(data);
    logger.info("retention.notifications.completed", "cleanup ok", {
      deletedCount,
      durationMs,
      retentionDays: days,
    });
    return { ok: true, scope, retentionDays: days, deletedCount, durationMs };
  } catch (err) {
    const durationMs = t.stop({ retentionDays: days, failed: true });
    logger.error("retention.notifications", err, { durationMs, retentionDays: days });
    return {
      ok: false,
      scope,
      retentionDays: days,
      deletedCount: 0,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Audit logs retention cleanup.
 * RPC `cleanup_audit_logs(retention_days)` çağırır.
 */
export async function runAuditLogsRetention(
  adminClient: SupabaseClient,
  retentionDays: number = 365
): Promise<RetentionRunResult> {
  const scope = "audit_logs" as const;
  const days = clampRetention(retentionDays, AUDIT_LOGS_MIN_DAYS, 365);
  const t = startTiming(`retention.${scope}`);
  try {
    const { data, error } = await adminClient.rpc("cleanup_audit_logs", {
      retention_days: days,
    });
    const durationMs = t.stop({ retentionDays: days });
    if (error) {
      logger.warn("retention.audit_logs.failed", error.message, { durationMs, retentionDays: days });
      return { ok: false, scope, retentionDays: days, deletedCount: 0, durationMs, error: error.message };
    }
    const deletedCount = extractDeletedCount(data);
    logger.info("retention.audit_logs.completed", "cleanup ok", {
      deletedCount,
      durationMs,
      retentionDays: days,
    });
    return { ok: true, scope, retentionDays: days, deletedCount, durationMs };
  } catch (err) {
    const durationMs = t.stop({ retentionDays: days, failed: true });
    logger.error("retention.audit_logs", err, { durationMs, retentionDays: days });
    return {
      ok: false,
      scope,
      retentionDays: days,
      deletedCount: 0,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Supabase `.rpc()` "table-valued" function tablo döner (Array<{ deleted_count }>).
 * Defensive: scalar dönerse de `0` fallback.
 */
function extractDeletedCount(data: unknown): number {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown> | undefined;
    const value = first?.deleted_count ?? first?.deletedCount;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  if (typeof data === "number" && Number.isFinite(data)) return data;
  return 0;
}
