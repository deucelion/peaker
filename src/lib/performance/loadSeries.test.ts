import { describe, expect, it } from "vitest";
import type { TrainingLoadRow } from "@/types/performance";
import {
  fillCalendarDays,
  isSyntheticEmptyDay,
  processACWRData,
  SYNTHETIC_EMPTY_DAY_PROFILE_ID,
} from "./loadSeries";

const TZ = "Europe/Istanbul";

describe("fillCalendarDays (Faz 2.6)", () => {
  it("aralıkta hiç kayıt yoksa her gün için 0-yük synthetic satır üretir", () => {
    const out = fillCalendarDays([], "2026-05-01", "2026-05-03", TZ);
    expect(out).toHaveLength(3);
    expect(out.every(isSyntheticEmptyDay)).toBe(true);
    expect(out.every((r) => Number(r.total_load) === 0)).toBe(true);
    expect(out.every((r) => r.profile_id === SYNTHETIC_EMPTY_DAY_PROFILE_ID)).toBe(true);
  });

  it("var olan günleri korur, eksik günleri synthetic olarak ekler ve sıralı döner", () => {
    const loads: TrainingLoadRow[] = [
      {
        profile_id: "p1",
        measurement_date: "2026-05-01T09:00:00.000Z",
        total_load: 320,
        rpe_score: 6,
      },
      {
        profile_id: "p1",
        measurement_date: "2026-05-04T09:00:00.000Z",
        total_load: 410,
        rpe_score: 7,
      },
    ];
    const out = fillCalendarDays(loads, "2026-05-01", "2026-05-04", TZ);
    expect(out).toHaveLength(4);
    expect(out[0].total_load).toBe(320);
    expect(isSyntheticEmptyDay(out[0])).toBe(false);
    expect(out[1].total_load).toBe(0);
    expect(isSyntheticEmptyDay(out[1])).toBe(true);
    expect(out[2].total_load).toBe(0);
    expect(out[3].total_load).toBe(410);
    expect(isSyntheticEmptyDay(out[3])).toBe(false);
  });

  it("range dışı satırları yok sayar", () => {
    const loads: TrainingLoadRow[] = [
      {
        profile_id: "p1",
        measurement_date: "2026-04-25T09:00:00.000Z",
        total_load: 9999,
        rpe_score: 9,
      },
    ];
    const out = fillCalendarDays(loads, "2026-05-01", "2026-05-02", TZ);
    expect(out).toHaveLength(2);
    expect(out.every(isSyntheticEmptyDay)).toBe(true);
  });

  it("from > to ise boş dizi döner (defansif)", () => {
    expect(fillCalendarDays([], "2026-05-05", "2026-05-01", TZ)).toEqual([]);
  });

  it("processACWRData fill uygulanmış seride takvim günü pencere uygular", () => {
    const fromKey = "2026-05-01";
    const toKey = "2026-05-10";
    const loads: TrainingLoadRow[] = [
      { profile_id: "p1", measurement_date: "2026-05-09T09:00:00.000Z", total_load: 700, rpe_score: 8 },
      { profile_id: "p1", measurement_date: "2026-05-10T09:00:00.000Z", total_load: 700, rpe_score: 8 },
    ];
    const filled = fillCalendarDays(loads, fromKey, toKey, TZ);
    const acwr = processACWRData(filled);
    expect(acwr).toHaveLength(10);
    const lastPoint = acwr[acwr.length - 1];
    // Akut/kronik 7g pencere; 8 boş + 2 yüklü → akut > 0; oran sınırlı
    expect(lastPoint.akut).toBeGreaterThan(0);
    expect(lastPoint.kronik).toBeGreaterThan(0);
    expect(lastPoint.ratio).toBeGreaterThan(0);
  });
});
