import { describe, expect, it } from "vitest";
import { computeDayOverlapLayout } from "@/app/(dashboard)/haftalik-ders-programi/_utils/scheduleGrid";
import type { WeeklyLessonScheduleItem } from "@/lib/types";

function privateSameSlot(index: number): WeeklyLessonScheduleItem {
  return {
    id: `private-${index}`,
    sourceType: "private",
    title: `Özel ${index}`,
    subtitle: null,
    coachId: "coach-1",
    coachName: "Koç",
    participantCount: 1,
    participantNames: [`Sporcu ${index}`],
    startsAt: "2026-05-20T12:00:00.000Z",
    endsAt: "2026-05-20T13:00:00.000Z",
    location: null,
    locationColor: null,
    note: null,
    detailHref: `/ozel-ders-paketleri/pkg-${index}`,
    status: "planned",
    packageId: `pkg-${index}`,
  };
}

describe("computeDayOverlapLayout parallel private lessons", () => {
  it("lays out 3 overlapping private lessons in one group", () => {
    const items = [privateSameSlot(0), privateSameSlot(1), privateSameSlot(2)];
    const layout = computeDayOverlapLayout(items);
    expect(layout).toHaveLength(3);
    expect(layout.every((row) => row.groupSize === 3)).toBe(true);
    expect(new Set(layout.map((r) => r.groupId)).size).toBe(1);
  });

  it("lays out 10 overlapping private lessons with distinct ids", () => {
    const items = Array.from({ length: 10 }, (_, i) => privateSameSlot(i));
    const layout = computeDayOverlapLayout(items);
    expect(layout).toHaveLength(10);
    expect(layout.every((row) => row.groupSize === 10)).toBe(true);
    expect(new Set(layout.map((r) => r.item.id)).size).toBe(10);
  });
});
