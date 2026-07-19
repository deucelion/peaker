import { describe, expect, it } from "vitest";
import {
  coachMayManagePrivateLessonSession,
  mapRpcCompleteErrorToUserMessage,
  resolveWeeklyPrivateCompleteUi,
} from "@/lib/privateLessons/completeSessionPolicy";
import type { WeeklyLessonScheduleItem } from "@/lib/types";

function privateItem(
  overrides: Partial<WeeklyLessonScheduleItem> = {}
): WeeklyLessonScheduleItem {
  return {
    id: "sess-1",
    sourceType: "private",
    title: "Özel Ders",
    subtitle: null,
    coachId: "coach-1",
    coachName: "Koç",
    participantCount: 1,
    participantNames: ["Sporcu"],
    startsAt: "2026-05-20T10:00:00.000Z",
    endsAt: "2026-05-20T11:00:00.000Z",
    location: null,
    locationColor: null,
    note: null,
    detailHref: "/ozel-ders-paketleri/pkg-1",
    status: "planned",
    packageId: "pkg-1",
    packageLifecycleStatus: "active",
    packageRemainingLessons: 3,
    packageTotalLessons: 8,
    packageUsedLessons: 5,
    packageIsActive: true,
    ...overrides,
  };
}

describe("resolveWeeklyPrivateCompleteUi", () => {
  it("hides button for group lessons", () => {
    const ui = resolveWeeklyPrivateCompleteUi({
      ...privateItem(),
      sourceType: "group",
    });
    expect(ui.showButton).toBe(false);
  });

  it("allows submit for planned active package with remaining", () => {
    const ui = resolveWeeklyPrivateCompleteUi(privateItem());
    expect(ui.showButton).toBe(true);
    expect(ui.canSubmit).toBe(true);
    expect(ui.disabledReason).toBeNull();
  });

  it("shows completed badge when session completed", () => {
    const ui = resolveWeeklyPrivateCompleteUi(privateItem({ status: "completed" }));
    expect(ui.showCompletedBadge).toBe(true);
    expect(ui.showButton).toBe(false);
  });

  it("blocks paused package", () => {
    const ui = resolveWeeklyPrivateCompleteUi(
      privateItem({ packageLifecycleStatus: "paused", packageIsActive: false })
    );
    expect(ui.canSubmit).toBe(false);
    expect(ui.disabledReason).toContain("dondurulmuş");
  });

  it("blocks zero remaining", () => {
    const ui = resolveWeeklyPrivateCompleteUi(privateItem({ packageRemainingLessons: 0 }));
    expect(ui.canSubmit).toBe(false);
    expect(ui.blockReason).toBe("no_remaining");
  });

  it("hides button when cancelled", () => {
    const ui = resolveWeeklyPrivateCompleteUi(privateItem({ status: "cancelled" }));
    expect(ui.showButton).toBe(false);
  });
});

describe("mapRpcCompleteErrorToUserMessage", () => {
  it("maps duplicate completion", () => {
    expect(mapRpcCompleteErrorToUserMessage("Bu oturum zaten işlenmiş.")).toContain("zaten");
  });
});

describe("coachMayManagePrivateLessonSession", () => {
  const perms = { can_manage_training_notes: true } as never;

  it("allows admin for any session coach", () => {
    expect(coachMayManagePrivateLessonSession("admin", null, "coach-other", "coach-me")).toBe(true);
  });

  it("allows coach for own session", () => {
    expect(coachMayManagePrivateLessonSession("coach", perms, "coach-me", "coach-me")).toBe(true);
  });

  it("allows coach with training notes permission for other coach session", () => {
    expect(coachMayManagePrivateLessonSession("coach", perms, "coach-other", "coach-me")).toBe(true);
  });

  it("denies coach without training notes permission for other coach session", () => {
    expect(
      coachMayManagePrivateLessonSession("coach", { can_manage_training_notes: false } as never, "coach-other", "coach-me")
    ).toBe(false);
  });
});
