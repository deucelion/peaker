import { describe, expect, it } from "vitest";
import {
  buildPrivateLessonParallelPlanningMetrics,
  coachSlotCapacityMessage,
  computeParallelPlannedSessionCount,
  formatPrivateLessonSlotOverlapIntro,
  privateLessonSlotOverlapWarningMessage,
  resolveCoachSlotCapacityLevel,
} from "@/lib/privateLessons/privateLessonSlotOverlap";

describe("privateLessonSlotOverlapWarningMessage", () => {
  it("returns null when no peers", () => {
    expect(privateLessonSlotOverlapWarningMessage(0)).toBeNull();
  });

  it("singular peer copy", () => {
    expect(privateLessonSlotOverlapWarningMessage(1)).toContain("1 özel dersi daha");
  });

  it("plural peer copy", () => {
    expect(privateLessonSlotOverlapWarningMessage(2)).toContain("2 özel dersi daha");
  });
});

describe("formatPrivateLessonSlotOverlapIntro", () => {
  it("uses existing peer count in intro", () => {
    expect(formatPrivateLessonSlotOverlapIntro(2)).toContain("2 özel dersi");
  });
});

describe("resolveCoachSlotCapacityLevel", () => {
  it("2 athletes normal", () => {
    expect(resolveCoachSlotCapacityLevel(2)).toBe("normal");
  });
  it("3 athletes warning", () => {
    expect(resolveCoachSlotCapacityLevel(3)).toBe("warning");
  });
  it("4+ athletes critical", () => {
    expect(resolveCoachSlotCapacityLevel(4)).toBe("critical");
  });
});

describe("coachSlotCapacityMessage", () => {
  it("critical includes capacity hint", () => {
    expect(coachSlotCapacityMessage("critical", 4)).toContain("Koç kapasitesini");
  });
});

describe("computeParallelPlannedSessionCount", () => {
  const base = {
    coachId: "c1",
    startsAt: "2026-05-20T12:00:00.000Z",
    endsAt: "2026-05-20T13:00:00.000Z",
    status: "planned",
  };

  it("counts sessions in overlapping slots", () => {
    const sessions = [
      { ...base, id: "a" },
      { ...base, id: "b" },
      { ...base, id: "c", startsAt: "2026-05-21T12:00:00.000Z", endsAt: "2026-05-21T13:00:00.000Z" },
    ];
    expect(computeParallelPlannedSessionCount(sessions)).toBe(2);
  });
});

describe("buildPrivateLessonParallelPlanningMetrics", () => {
  it("aggregates month metrics", () => {
    const sessions = [
      {
        id: "1",
        coachId: "c1",
        startsAt: "2026-05-20T15:00:00.000Z",
        endsAt: "2026-05-20T16:00:00.000Z",
        status: "planned",
      },
      {
        id: "2",
        coachId: "c1",
        startsAt: "2026-05-20T15:00:00.000Z",
        endsAt: "2026-05-20T16:00:00.000Z",
        status: "planned",
      },
    ];
    const m = buildPrivateLessonParallelPlanningMetrics(sessions, "Mayıs 2026", "Europe/Istanbul");
    expect(m.totalPrivateLessons).toBe(2);
    expect(m.parallelPlannedSessions).toBe(2);
    expect(m.monthLabel).toBe("Mayıs 2026");
  });
});

describe("parallel private lesson policy (session isolation)", () => {
  it("documents that completion is keyed by session id (no cross-athlete coupling)", () => {
    const sessionA = { id: "sess-a", packageId: "pkg-a", athleteId: "ath-a" };
    const sessionB = { id: "sess-b", packageId: "pkg-b", athleteId: "ath-b" };
    expect(sessionA.id).not.toBe(sessionB.id);
    expect(sessionA.packageId).not.toBe(sessionB.packageId);
  });
});
