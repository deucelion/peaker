/**
 * Faz 13.1 — Stuck job rescue via `peaker_jobs_rescue_stuck` RPC.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/monitoring/logger";

export type StuckJobRescueResult = {
  rescued: number;
  deadStuck: number;
  error?: string;
};

export async function runStuckJobRescue(
  adminClient: SupabaseClient,
  afterSeconds: number = 600
): Promise<StuckJobRescueResult> {
  try {
    const { data, error } = await adminClient.rpc("peaker_jobs_rescue_stuck", {
      p_after_seconds: Math.max(60, Math.floor(afterSeconds)),
    });
    if (error) {
      logger.warn("worker.rescue", "rpc failed", { reason: error.message });
      return { rescued: 0, deadStuck: 0, error: error.message };
    }
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
    const rescued = Number(row?.rescued_count ?? row?.rescued ?? 0) || 0;
    const deadStuck = Number(row?.dead_stuck_count ?? row?.deadstuck ?? 0) || 0;
    if (rescued > 0 || deadStuck > 0) {
      logger.info("worker.rescue", "stuck jobs processed", { rescued, deadStuck });
    }
    return { rescued, deadStuck };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("worker.rescue", "exception", { reason: msg });
    return { rescued: 0, deadStuck: 0, error: msg };
  }
}
