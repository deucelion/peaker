/**
 * Faz 11.2 — `monthly_finance_summary` MV read path helper.
 *
 * - Sadece KPI (totalCollected + pendingCollection) için MV'den okur.
 * - Payment listesi her zaman live `payments` tablosundan okunur.
 * - Stale detection: refreshed_at > STALE_THRESHOLD_MS → fallback'e zorla.
 * - Caller fallback'i live aggregation'a aktarmalı.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/monitoring/logger";

export const MONTHLY_FINANCE_MV_STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000; // 26h

export type MonthlyFinanceKpi = {
  totalCollected: number;
  pendingCollection: number;
  paymentCount: number;
  overdueCount: number;
  source: "mv" | "live";
  refreshedAt: string | null;
  stale: boolean;
};

export type MonthlyFinanceMvLookupOptions = {
  organizationId: string;
  monthKey: string; // YYYY-MM
  /** Stale tolerance override (ms). Default 26h. */
  staleThresholdMs?: number;
};

export type MonthlyFinanceMvLookupResult =
  | { status: "ok"; kpi: MonthlyFinanceKpi }
  | { status: "missing" }
  | { status: "stale"; refreshedAt: string | null }
  | { status: "error"; reason: string };

type MonthlyFinanceMvRow = {
  organization_id: string;
  month_key: string;
  payment_count: number | null;
  collected_amount: number | null;
  pending_amount: number | null;
  overdue_count: number | null;
  refreshed_at: string | null;
};

export async function lookupMonthlyFinanceMv(
  adminClient: SupabaseClient,
  options: MonthlyFinanceMvLookupOptions
): Promise<MonthlyFinanceMvLookupResult> {
  const staleThreshold = options.staleThresholdMs ?? MONTHLY_FINANCE_MV_STALE_THRESHOLD_MS;
  try {
    const { data, error } = await adminClient
      .from("monthly_finance_summary")
      .select("organization_id, month_key, payment_count, collected_amount, pending_amount, overdue_count, refreshed_at")
      .eq("organization_id", options.organizationId)
      .eq("month_key", options.monthKey)
      .maybeSingle<MonthlyFinanceMvRow>();
    if (error) {
      logger.info("finance.mv", "MV erişim hatası", {
        organizationId: options.organizationId,
        monthKey: options.monthKey,
        reason: error.message,
      });
      return { status: "error", reason: error.message };
    }
    if (!data) {
      return { status: "missing" };
    }
    const refreshedAt = data.refreshed_at;
    const ageMs = refreshedAt ? Date.now() - new Date(refreshedAt).getTime() : Number.POSITIVE_INFINITY;
    if (ageMs > staleThreshold) {
      return { status: "stale", refreshedAt };
    }
    return {
      status: "ok",
      kpi: {
        totalCollected: Number(data.collected_amount ?? 0),
        pendingCollection: Number(data.pending_amount ?? 0),
        paymentCount: Number(data.payment_count ?? 0),
        overdueCount: Number(data.overdue_count ?? 0),
        source: "mv",
        refreshedAt,
        stale: false,
      },
    };
  } catch (e) {
    return { status: "error", reason: (e as Error).message };
  }
}
