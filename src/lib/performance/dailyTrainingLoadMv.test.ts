import { describe, it, expect } from "vitest";
import {
  shouldUseDailyTrainingLoadMv,
  reduceMvRowsToTeamDayRows,
} from "./dailyTrainingLoadMv";
import { aggregateTrainingLoadsByCalendarDay, processACWRData, processEWMAData } from "./loadSeries";
import type { TrainingLoadRow } from "@/types/performance";

describe("shouldUseDailyTrainingLoadMv", () => {
  it("feature_off when flag disabled", () => {
    expect(
      shouldUseDailyTrainingLoadMv({
        athleteProfileId: null,
        profileCount: 100,
        dayCount: 90,
        featureEnabled: false,
      })
    ).toEqual({ eligible: false, reason: "feature_off" });
  });

  it("single_athlete when athleteProfileId provided", () => {
    expect(
      shouldUseDailyTrainingLoadMv({
        athleteProfileId: "athlete-1",
        profileCount: 100,
        dayCount: 90,
        featureEnabled: true,
      })
    ).toEqual({ eligible: false, reason: "single_athlete" });
  });

  it("too_few_profiles when profileCount under threshold", () => {
    expect(
      shouldUseDailyTrainingLoadMv({
        athleteProfileId: null,
        profileCount: 10,
        dayCount: 90,
        featureEnabled: true,
        minProfiles: 20,
        minDays: 14,
      })
    ).toEqual({ eligible: false, reason: "too_few_profiles" });
  });

  it("too_few_days when dayCount under threshold", () => {
    expect(
      shouldUseDailyTrainingLoadMv({
        athleteProfileId: null,
        profileCount: 50,
        dayCount: 7,
        featureEnabled: true,
        minProfiles: 20,
        minDays: 14,
      })
    ).toEqual({ eligible: false, reason: "too_few_days" });
  });

  it("eligible when all thresholds met", () => {
    expect(
      shouldUseDailyTrainingLoadMv({
        athleteProfileId: null,
        profileCount: 50,
        dayCount: 90,
        featureEnabled: true,
        minProfiles: 20,
        minDays: 14,
      })
    ).toEqual({ eligible: true, reason: "ok" });
  });
});

describe("reduceMvRowsToTeamDayRows — parity with live aggregate", () => {
  it("returns empty array for empty input", () => {
    expect(reduceMvRowsToTeamDayRows([])).toEqual([]);
  });

  it("produces identical total_load to live aggregate for single-session-per-athlete case", () => {
    // Senaryo: D1'de iki sporcu, her birinin 1 sessionı var (load 100 ve 200).
    // Live training_loads: [{load:100, rpe:5}, {load:200, rpe:7}]
    // Aggregate: sumLoad=300, rowN=2, total=150; rpe sum=12, n=2, avg=6.
    const liveRows: TrainingLoadRow[] = [
      { profile_id: "a", measurement_date: "2026-01-01T08:00:00Z", total_load: 100, rpe_score: 5 },
      { profile_id: "b", measurement_date: "2026-01-01T09:00:00Z", total_load: 200, rpe_score: 7 },
    ];
    const liveAgg = aggregateTrainingLoadsByCalendarDay(liveRows);

    // MV equivalent: 2 satır, her birinde session_count=1
    const mvAgg = reduceMvRowsToTeamDayRows([
      {
        organization_id: "org",
        profile_id: "a",
        training_day: "2026-01-01",
        total_load: 100,
        avg_rpe: 5,
        session_count: 1,
        last_recorded_at: null,
        refreshed_at: null,
      },
      {
        organization_id: "org",
        profile_id: "b",
        training_day: "2026-01-01",
        total_load: 200,
        avg_rpe: 7,
        session_count: 1,
        last_recorded_at: null,
        refreshed_at: null,
      },
    ]);

    expect(mvAgg).toHaveLength(1);
    expect(liveAgg).toHaveLength(1);
    expect(mvAgg[0].total_load).toBe(liveAgg[0].total_load);
    expect(mvAgg[0].rpe_score).toBe(liveAgg[0].rpe_score);
  });

  it("preserves parity when an athlete has multiple sessions same day", () => {
    // D1: A 2 session (load 100, 150 ; rpe 5, 7), B 1 session (load 200; rpe 8)
    // Live aggregate: sum=450, rowN=3, total=150 (450/3). RPE sum=20, n=3, avg=6.67 → round 6.7
    const liveRows: TrainingLoadRow[] = [
      { profile_id: "a", measurement_date: "2026-01-01T08:00:00Z", total_load: 100, rpe_score: 5 },
      { profile_id: "a", measurement_date: "2026-01-01T15:00:00Z", total_load: 150, rpe_score: 7 },
      { profile_id: "b", measurement_date: "2026-01-01T09:00:00Z", total_load: 200, rpe_score: 8 },
    ];
    const liveAgg = aggregateTrainingLoadsByCalendarDay(liveRows);
    // MV equivalent:
    //   A: total_load=250, session_count=2, avg_rpe=6 (mean of 5,7)
    //   B: total_load=200, session_count=1, avg_rpe=8
    // MV team-day: loadSum=450, sessionSum=3, total=150
    //              rpeWeighted= 6*2 + 8*1 = 20, rpeSessionSum=3, rpe=20/3=6.67 → 6.7
    const mvAgg = reduceMvRowsToTeamDayRows([
      {
        organization_id: "org",
        profile_id: "a",
        training_day: "2026-01-01",
        total_load: 250,
        avg_rpe: 6,
        session_count: 2,
        last_recorded_at: null,
        refreshed_at: null,
      },
      {
        organization_id: "org",
        profile_id: "b",
        training_day: "2026-01-01",
        total_load: 200,
        avg_rpe: 8,
        session_count: 1,
        last_recorded_at: null,
        refreshed_at: null,
      },
    ]);

    expect(mvAgg).toHaveLength(1);
    expect(liveAgg).toHaveLength(1);
    expect(mvAgg[0].total_load).toBe(liveAgg[0].total_load);
    expect(mvAgg[0].rpe_score).toBe(liveAgg[0].rpe_score);
  });

  it("handles null avg_rpe sessions and produces null when no session has RPE", () => {
    const mvAgg = reduceMvRowsToTeamDayRows([
      {
        organization_id: "org",
        profile_id: "a",
        training_day: "2026-01-01",
        total_load: 100,
        avg_rpe: null,
        session_count: 2,
        last_recorded_at: null,
        refreshed_at: null,
      },
    ]);
    expect(mvAgg).toHaveLength(1);
    expect(mvAgg[0].total_load).toBe(50); // 100 / 2
    expect(mvAgg[0].rpe_score).toBeNull();
  });

  it("ACWR/EWMA stays identical when fed live-aggregated vs MV-aggregated rows for same effective dataset", () => {
    // 5 günlük, her gün 2 sporcu, her sporcunun 1 sessionı var.
    const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];
    const liveRows: TrainingLoadRow[] = [];
    const mvRows: Parameters<typeof reduceMvRowsToTeamDayRows>[0] = [];
    days.forEach((d, idx) => {
      const loadA = 100 + idx * 10;
      const loadB = 150 + idx * 5;
      liveRows.push({
        profile_id: "a",
        measurement_date: `${d}T08:00:00Z`,
        total_load: loadA,
        rpe_score: 5,
      });
      liveRows.push({
        profile_id: "b",
        measurement_date: `${d}T09:00:00Z`,
        total_load: loadB,
        rpe_score: 7,
      });
      mvRows.push({
        organization_id: "org",
        profile_id: "a",
        training_day: d,
        total_load: loadA,
        avg_rpe: 5,
        session_count: 1,
        last_recorded_at: null,
        refreshed_at: null,
      });
      mvRows.push({
        organization_id: "org",
        profile_id: "b",
        training_day: d,
        total_load: loadB,
        avg_rpe: 7,
        session_count: 1,
        last_recorded_at: null,
        refreshed_at: null,
      });
    });

    const liveAgg = aggregateTrainingLoadsByCalendarDay(liveRows);
    const mvAgg = reduceMvRowsToTeamDayRows(mvRows);

    const liveAcwr = processACWRData(liveAgg);
    const mvAcwr = processACWRData(mvAgg);
    const liveEwma = processEWMAData(liveAgg);
    const mvEwma = processEWMAData(mvAgg);

    expect(mvAcwr.length).toBe(liveAcwr.length);
    expect(mvEwma.length).toBe(liveEwma.length);
    for (let i = 0; i < liveAcwr.length; i += 1) {
      expect(mvAcwr[i].akut).toBe(liveAcwr[i].akut);
      expect(mvAcwr[i].kronik).toBe(liveAcwr[i].kronik);
      expect(mvAcwr[i].ratio).toBe(liveAcwr[i].ratio);
      expect(mvEwma[i].acuteEwma).toBe(liveEwma[i].acuteEwma);
      expect(mvEwma[i].chronicEwma).toBe(liveEwma[i].chronicEwma);
      expect(mvEwma[i].ewmaRatio).toBe(liveEwma[i].ewmaRatio);
    }
  });
});
