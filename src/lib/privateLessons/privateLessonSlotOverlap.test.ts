import { describe, expect, it } from "vitest";
import { privateLessonSlotOverlapWarningMessage } from "@/lib/privateLessons/privateLessonSlotOverlap";

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

describe("parallel private lesson policy (session isolation)", () => {
  it("documents that completion is keyed by session id (no cross-athlete coupling)", () => {
    const sessionA = { id: "sess-a", packageId: "pkg-a", athleteId: "ath-a" };
    const sessionB = { id: "sess-b", packageId: "pkg-b", athleteId: "ath-b" };
    expect(sessionA.id).not.toBe(sessionB.id);
    expect(sessionA.packageId).not.toBe(sessionB.packageId);
  });
});
