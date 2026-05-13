/**
 * Faz 12.2 — `daily_training_load_aggregates` MV read-path helper.
 *
 * Karar matrisi (`shouldUseDailyTrainingLoadMv`):
 *   - Feature flag açık (`PEAKER_PERF_MV_READ=1`)
 *   - Team mode (athleteProfileId == null) — tek sporcuda MV kazancı marjinal
 *   - profileCount >= PEAKER_PERF_MV_MIN_PROFILES (default 20)
 *   - dayCount >= PEAKER_PERF_MV_MIN_DAYS (default 14)
 *
 * Eğer yukarıdaki koşullar karşılanırsa MV'den okuruz. MV satırları
 * sporcu × gün × toplam yük şeklindedir; mevcut `training_loads` shape'e
 * adapte edip `aggregateTrainingLoadsByCalendarDay → processACWRData / EWMA`
 * pipeline'ına SOKARIZ. Bu sayede ACWR/EWMA parity korunur — sadece veri
 * kaynağı değişir.
 *
 * Stale check:
 *   - MV satırlarının max(training_day) bugüne çok yakın olmalı; refresh
 *     6 saatte bir. Stale tolerance default 12h (bir tick gecikme payı +
 *     refresh süresi). Stale ise live fallback.
 *
 * Parity garantisi:
 *   - MV row shape: `{ organization_id, profile_id, training_day, total_load,
 *     avg_rpe, session_count, last_recorded_at, refreshed_at }`.
 *   - Adapter row: `{ profile_id, measurement_date (training_day @ 12:00 UTC),
 *     total_load, rpe_score (avg_rpe) }`.
 *   - aggregateTrainingLoadsByCalendarDay sumLoad/rowN ortalamayı korur;
 *     MV'de zaten sporcu-gün toplamı olduğundan team aggregate aynı sonucu
 *     üretir (parity test ile doğrulanır).
 *
 * Backward compatible:
 *   - Feature flag default kapalı; aktive edilene kadar tüm call site'lar
 *     mevcut chunked .in() path'inde kalır.
 *   - MV erişimi başarısız olursa caller live aggregation'a düşer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/monitoring/logger";
import type { TrainingLoadRow } from "@/types/performance";

export const PEAKER_PERF_MV_DEFAULT_MIN_PROFILES = 20;
export const PEAKER_PERF_MV_DEFAULT_MIN_DAYS = 14;
export const PEAKER_PERF_MV_DEFAULT_STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export type DailyTrainingLoadMvEligibilityInput = {
  athleteProfileId: string | null;
  profileCount: number;
  dayCount: number;
  /** Override: PEAKER_PERF_MV_READ env. Caller bu değeri set edebilir. */
  featureEnabled?: boolean;
  /** Override: PEAKER_PERF_MV_MIN_PROFILES. */
  minProfiles?: number;
  /** Override: PEAKER_PERF_MV_MIN_DAYS. */
  minDays?: number;
};

export type DailyTrainingLoadMvEligibility =
  | { eligible: true; reason: "ok" }
  | { eligible: false; reason: "feature_off" | "single_athlete" | "too_few_profiles" | "too_few_days" };

function readBoolEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function readIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function shouldUseDailyTrainingLoadMv(
  input: DailyTrainingLoadMvEligibilityInput
): DailyTrainingLoadMvEligibility {
  const featureEnabled =
    input.featureEnabled ?? readBoolEnv(process.env.PEAKER_PERF_MV_READ);
  if (!featureEnabled) return { eligible: false, reason: "feature_off" };

  if (input.athleteProfileId !== null) {
    return { eligible: false, reason: "single_athlete" };
  }
  const minProfiles =
    input.minProfiles ?? readIntEnv(process.env.PEAKER_PERF_MV_MIN_PROFILES, PEAKER_PERF_MV_DEFAULT_MIN_PROFILES);
  if (input.profileCount < minProfiles) {
    return { eligible: false, reason: "too_few_profiles" };
  }
  const minDays =
    input.minDays ?? readIntEnv(process.env.PEAKER_PERF_MV_MIN_DAYS, PEAKER_PERF_MV_DEFAULT_MIN_DAYS);
  if (input.dayCount < minDays) {
    return { eligible: false, reason: "too_few_days" };
  }
  return { eligible: true, reason: "ok" };
}

export type DailyTrainingLoadMvFetchInput = {
  organizationId: string;
  /** YYYY-MM-DD inclusive. */
  fromKey: string;
  /** YYYY-MM-DD inclusive. */
  toKey: string;
  staleThresholdMs?: number;
};

export type DailyTrainingLoadMvFetchResult =
  | {
      status: "ok";
      /**
       * Team-day shape: her satır bir takvim günü için zaten aggregated
       * görünür. Bu yüzden caller `aggregateTrainingLoadsByCalendarDay`'i
       * tekrar çağırmamalıdır. Format `TrainingLoadRow` ile uyumlu, ACWR/EWMA
       * pipeline'a doğrudan beslenebilir.
       */
      rows: TrainingLoadRow[];
      refreshedAt: string | null;
      stale: boolean;
      mvRowCount: number;
    }
  | {
      status: "stale";
      refreshedAt: string | null;
    }
  | {
      status: "empty";
    }
  | {
      status: "error";
      reason: string;
    };

type MvRow = {
  organization_id: string;
  profile_id: string;
  training_day: string;
  total_load: string | number | null;
  avg_rpe: string | number | null;
  session_count: number | null;
  last_recorded_at: string | null;
  refreshed_at: string | null;
};

/**
 * MV satırlarını (athlete × day) → team-day satırlarına indirgenir. Live
 * `aggregateTrainingLoadsByCalendarDay` ile MATHEMATIK PARITY:
 *   - total_load = sum(mv.total_load) / sum(mv.session_count)
 *     (live: sum(session.load) / count(sessions))
 *   - rpe_score = sum(mv.avg_rpe * mv.session_count [rpe not null]) /
 *                  sum(mv.session_count [rpe not null])
 *     (live: sum(session.rpe) / count(session.rpe not null))
 *
 * MV'nin `avg_rpe` zaten athlete-day session-RPE ortalaması; çarpıp
 * session_count ile back-weight ettiğimizde session RPE'lerin toplamı çıkar.
 */
export function reduceMvRowsToTeamDayRows(rows: MvRow[]): TrainingLoadRow[] {
  if (rows.length === 0) return [];
  type Acc = { loadSum: number; sessionSum: number; rpeWeightedSum: number; rpeSessionSum: number };
  const byDay = new Map<string, Acc>();
  for (const r of rows) {
    const day = r.training_day;
    if (!day) continue;
    const sessionCount = Number(r.session_count ?? 0) || 0;
    if (sessionCount <= 0) continue;
    const totalLoad = Number(r.total_load ?? 0) || 0;
    const avgRpe = r.avg_rpe == null ? null : Number(r.avg_rpe);
    const cur = byDay.get(day) ?? { loadSum: 0, sessionSum: 0, rpeWeightedSum: 0, rpeSessionSum: 0 };
    cur.loadSum += totalLoad;
    cur.sessionSum += sessionCount;
    if (avgRpe != null && Number.isFinite(avgRpe) && avgRpe > 0) {
      cur.rpeWeightedSum += avgRpe * sessionCount;
      cur.rpeSessionSum += sessionCount;
    }
    byDay.set(day, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, agg]) => ({
      profile_id: "__team_day__",
      measurement_date: `${day}T12:00:00.000Z`,
      total_load:
        agg.sessionSum > 0
          ? Math.round((agg.loadSum / agg.sessionSum) * 10) / 10
          : 0,
      rpe_score:
        agg.rpeSessionSum > 0
          ? Math.round((agg.rpeWeightedSum / agg.rpeSessionSum) * 10) / 10
          : null,
    }));
}

export async function fetchDailyTrainingLoadMvRows(
  adminClient: SupabaseClient,
  input: DailyTrainingLoadMvFetchInput
): Promise<DailyTrainingLoadMvFetchResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(input.toKey)) {
    return { status: "error", reason: "invalid_date_range" };
  }
  const staleThreshold =
    input.staleThresholdMs ?? PEAKER_PERF_MV_DEFAULT_STALE_THRESHOLD_MS;

  try {
    const { data, error } = await adminClient
      .from("daily_training_load_aggregates")
      .select(
        "organization_id, profile_id, training_day, total_load, avg_rpe, session_count, last_recorded_at, refreshed_at"
      )
      .eq("organization_id", input.organizationId)
      .gte("training_day", input.fromKey)
      .lte("training_day", input.toKey)
      .order("training_day", { ascending: true });
    if (error) {
      logger.info("performance.mv.read", "MV erişim hatası", {
        organizationId: input.organizationId,
        fromKey: input.fromKey,
        toKey: input.toKey,
        reason: error.message,
      });
      return { status: "error", reason: error.message };
    }
    const rows = (data ?? []) as MvRow[];
    if (rows.length === 0) {
      return { status: "empty" };
    }
    const refreshedAtIso = rows[0]?.refreshed_at ?? null;
    const refreshedTs = refreshedAtIso ? new Date(refreshedAtIso).getTime() : NaN;
    const stale = Number.isFinite(refreshedTs)
      ? Date.now() - refreshedTs > staleThreshold
      : true;
    if (stale) {
      return { status: "stale", refreshedAt: refreshedAtIso };
    }
    const teamDayRows = reduceMvRowsToTeamDayRows(rows);
    return {
      status: "ok",
      rows: teamDayRows,
      refreshedAt: refreshedAtIso,
      stale: false,
      mvRowCount: rows.length,
    };
  } catch (err) {
    return { status: "error", reason: (err as Error).message };
  }
}
