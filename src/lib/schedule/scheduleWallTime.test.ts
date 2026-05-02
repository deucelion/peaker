import { describe, expect, it } from "vitest";
import {
  SCHEDULE_APP_TIME_ZONE,
  isoToZonedClockMinutesFromMidnight,
  isoToZonedDateKey,
  parseLessonFormInstantToUtcIso,
  wallClockInZoneToUtcIso,
} from "./scheduleWallTime";

describe("scheduleWallTime", () => {
  it("wallClockInZoneToUtcIso maps Istanbul 08:00 to correct UTC instant", () => {
    const iso = wallClockInZoneToUtcIso("2026-04-27", "08:00", SCHEDULE_APP_TIME_ZONE);
    expect(iso).toBeTruthy();
    expect(iso).toBe("2026-04-27T05:00:00.000Z");
  });

  it("wallClockInZoneToUtcIso supports seconds", () => {
    const iso = wallClockInZoneToUtcIso("2026-04-27", "13:15:30", SCHEDULE_APP_TIME_ZONE);
    expect(iso).toBe("2026-04-27T10:15:30.000Z");
  });

  it("parseLessonFormInstantToUtcIso treats naive local datetime as Istanbul wall", () => {
    const iso = parseLessonFormInstantToUtcIso("2026-04-27T16:30");
    expect(iso).toBe("2026-04-27T13:30:00.000Z");
  });

  it("parseLessonFormInstantToUtcIso leaves explicit Z unchanged semantically", () => {
    const iso = parseLessonFormInstantToUtcIso("2026-04-27T05:00:00.000Z");
    expect(iso).toBe("2026-04-27T05:00:00.000Z");
  });

  it("isoToZonedDateKey reads calendar day in Istanbul", () => {
    expect(isoToZonedDateKey("2026-04-27T05:00:00.000Z")).toBe("2026-04-27");
  });

  it("isoToZonedClockMinutesFromMidnight uses Istanbul wall clock", () => {
    expect(isoToZonedClockMinutesFromMidnight("2026-04-27T05:00:00.000Z")).toBe(8 * 60);
  });
});
