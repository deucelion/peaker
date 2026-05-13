/**
 * Faz 12.6 — Queue / jobs log / heartbeat retention health helper.
 *
 * Karşılığı: supabase/migrations/20260515_jobs_retention.sql içindeki
 * `peaker_cleanup_jobs_retention(p_terminal_days, p_failed_days,
 * p_heartbeat_days, p_archive_days)` RPC'si.
 *
 * RPC tablo döner: [{ scope, removed_count }] (scope: terminal/failed/
 * heartbeat/archive).
 *
 * Bu helper:
 *   - RPC'yi server-side admin client ile çağırır.
 *   - Sonuçları structured log + caller-friendly tipte döner.
 *   - Hata fırlatmaz; `{ ok: false, error }` döner. Cron + sistem-operasyonlari
 *     paneli her ikisi de aynı helper'ı kullanır.
 *
 * Worker handler (`maintenance.jobsRetention`) Faz 12.7 ile eklendiğinde
 * bu helper'ı çağıracak.
 */

import { logger } from "./logger";
import { startTiming } from "./timing";
import type { SupabaseClient } from "@supabase/supabase-js";

export type JobsRetentionScope = "terminal" | "failed" | "heartbeat" | "archive";

export type JobsRetentionRunResult = {
  ok: boolean;
  durationMs: number;
  removedByScope: Record<JobsRetentionScope, number>;
  totals: {
    totalRemoved: number;
    terminalDays: number;
    failedDays: number;
    heartbeatDays: number;
    archiveDays: number;
  };
  error?: string;
};

const DEFAULTS = {
  terminalDays: 30,
  failedDays: 90,
  heartbeatDays: 7,
  archiveDays: 60,
};

const MIN_DAYS = {
  terminalDays: 7,
  failedDays: 14,
  heartbeatDays: 1,
  archiveDays: 7,
};

function clampDays(value: number | undefined, min: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const v = Math.floor(value);
  if (v < min) return fallback;
  return v;
}

function emptyScopes(): Record<JobsRetentionScope, number> {
  return { terminal: 0, failed: 0, heartbeat: 0, archive: 0 };
}

export async function runJobsRetention(
  adminClient: SupabaseClient,
  opts: {
    terminalDays?: number;
    failedDays?: number;
    heartbeatDays?: number;
    archiveDays?: number;
  } = {}
): Promise<JobsRetentionRunResult> {
  const terminalDays = clampDays(opts.terminalDays, MIN_DAYS.terminalDays, DEFAULTS.terminalDays);
  const failedDays = clampDays(opts.failedDays, MIN_DAYS.failedDays, DEFAULTS.failedDays);
  const heartbeatDays = clampDays(opts.heartbeatDays, MIN_DAYS.heartbeatDays, DEFAULTS.heartbeatDays);
  const archiveDays = clampDays(opts.archiveDays, MIN_DAYS.archiveDays, DEFAULTS.archiveDays);

  const t = startTiming("retention.jobs", { warnAfterMs: 4_000 });
  const totals = { totalRemoved: 0, terminalDays, failedDays, heartbeatDays, archiveDays };
  const removedByScope = emptyScopes();

  try {
    const { data, error } = await adminClient.rpc("peaker_cleanup_jobs_retention", {
      p_terminal_days: terminalDays,
      p_failed_days: failedDays,
      p_heartbeat_days: heartbeatDays,
      p_archive_days: archiveDays,
    });
    const durationMs = t.stop({ ...totals });

    if (error) {
      logger.warn("retention.jobs.failed", error.message, { durationMs, ...totals });
      return {
        ok: false,
        durationMs,
        removedByScope,
        totals,
        error: error.message,
      };
    }

    if (Array.isArray(data)) {
      for (const row of data as Array<{ scope?: string; removed_count?: number | string }>) {
        const scope = row?.scope;
        if (
          scope === "terminal" ||
          scope === "failed" ||
          scope === "heartbeat" ||
          scope === "archive"
        ) {
          const raw = row.removed_count;
          const count =
            typeof raw === "number"
              ? Math.max(0, Math.floor(raw))
              : typeof raw === "string"
                ? Math.max(0, Number.parseInt(raw, 10) || 0)
                : 0;
          removedByScope[scope] = count;
        }
      }
    }
    totals.totalRemoved =
      removedByScope.terminal +
      removedByScope.failed +
      removedByScope.heartbeat +
      removedByScope.archive;

    logger.info("retention.jobs.completed", "cleanup ok", {
      durationMs,
      ...removedByScope,
      ...totals,
    });
    return { ok: true, durationMs, removedByScope, totals };
  } catch (err) {
    const durationMs = t.stop({ ...totals, failed: true });
    logger.error("retention.jobs", err, { durationMs, ...totals });
    return {
      ok: false,
      durationMs,
      removedByScope,
      totals,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
