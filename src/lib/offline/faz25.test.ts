import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attendanceDraftKey,
  coachNoteIdempotencyKey,
  fieldTestDraftKey,
} from "@/lib/offline/draftKeys";
import {
  clearScopedFormDraft,
  loadScopedFormDraft,
  saveScopedFormDraft,
} from "@/lib/offline/scopedFormDrafts";
import { enqueueOfflineAction, listOfflineActions } from "@/lib/offline/offlineActionQueue";
import { riskForKind, canAutoReplayKind } from "@/lib/offline/actionRegistry";
import { conflictUiForActionKind } from "@/lib/offline/conflictMapping";
import {
  canAutoReplayNow,
  replayBackoffMs,
  shouldAutoRetryFailure,
} from "@/lib/offline/replayPolicy";
import { queueItemMetaFromPayload } from "@/lib/offline/queueItemMeta";
import { resetOfflineQueueForTests } from "@/lib/offline/queueStore";
import { clearOfflineStorage } from "@/lib/offline/storage";

describe("FAZ 25 scoped drafts", () => {
  const scope = "org-1:user-1";

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    });
  });

  it("saves and restores attendance draft", () => {
    const key = attendanceDraftKey("lesson-1", "user-1");
    saveScopedFormDraft(scope, key, {
      trainingId: "lesson-1",
      statuses: { p1: "attended" },
    });
    const loaded = loadScopedFormDraft(scope, key);
    expect(loaded?.payload.statuses).toEqual({ p1: "attended" });
    clearScopedFormDraft(scope, key);
    expect(loadScopedFormDraft(scope, key)).toBeNull();
  });

  it("saves field test draft with text and numeric values", () => {
    const key = fieldTestDraftKey("athlete-1", "2026-05-20", "user-1");
    saveScopedFormDraft(scope, key, {
      testValues: { "a1-m1": 12, "a1-m2": "metin not" },
      generalNotes: { a1: "genel" },
    });
    const loaded = loadScopedFormDraft(scope, key);
    expect(loaded?.payload.testValues).toMatchObject({ "a1-m1": 12, "a1-m2": "metin not" });
    expect(loaded?.payload.generalNotes).toEqual({ a1: "genel" });
  });

  it("coach note idempotency key is stable per draft", () => {
    expect(coachNoteIdempotencyKey("draft-abc")).toBe("coach-note:draft-abc");
  });
});

describe("FAZ 25 offline queue", () => {
  const scope = "org-1:user-1";

  beforeEach(() => {
    resetOfflineQueueForTests();
    clearOfflineStorage();
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    });
  });

  it("dedupes attendance enqueue by idempotency key", () => {
    enqueueOfflineAction({
      kind: "attendance_draft",
      scopeKey: scope,
      idempotencyKey: "attendance:t1:p1:attended",
      payload: { trainingId: "t1", profileId: "p1", status: "attended" },
    });
    enqueueOfflineAction({
      kind: "attendance_draft",
      scopeKey: scope,
      idempotencyKey: "attendance:t1:p1:attended",
      payload: { trainingId: "t1", profileId: "p1", status: "attended" },
    });
    expect(listOfflineActions(scope)).toHaveLength(1);
  });

  it("field test requires confirmation and no auto replay", () => {
    const item = enqueueOfflineAction({
      kind: "field_test_draft",
      scopeKey: scope,
      payload: { testDate: "2026-05-20", cells: [], selectedProfileIds: ["a1"] },
    });
    expect("error" in item).toBe(false);
    if ("error" in item) return;
    expect(item.status).toBe("requires_confirmation");
    expect(riskForKind("field_test_draft")).toBe("requires_confirmation");
    expect(canAutoReplayKind("field_test_draft")).toBe(false);
  });

  it("coach note requires confirmation", () => {
    const item = enqueueOfflineAction({
      kind: "coach_note_draft",
      scopeKey: scope,
      draftId: "d1",
      idempotencyKey: coachNoteIdempotencyKey("d1"),
      payload: { title: "Not", content: "x", weekStart: "2026-05-20", coachId: "c1", athleteIds: ["a1"] },
    });
    expect("error" in item).toBe(false);
    if ("error" in item) return;
    expect(item.status).toBe("requires_confirmation");
  });

  it("payment stays blocked", () => {
    const res = enqueueOfflineAction({
      kind: "payment_record_draft",
      scopeKey: scope,
      payload: {},
    });
    expect("error" in res).toBe(true);
  });

  it("attendance conflict hint mentions reopening lesson", () => {
    const ui = conflictUiForActionKind("attendance_draft", "çakışma");
    expect(ui.hint).toContain("tekrar aç");
  });

  it("queue meta builds navigation href", () => {
    const meta = queueItemMetaFromPayload("attendance_draft", {
      trainingId: "t99",
      athleteName: "Ali",
    });
    expect(meta.navigationHref).toContain("trainingId=t99");
    expect(meta.subjectLabel).toContain("Ali");
  });
});

describe("FAZ 25 replay policy", () => {
  it("does not auto retry validation errors", () => {
    expect(shouldAutoRetryFailure("validation_error")).toBe(false);
    expect(shouldAutoRetryFailure("permission_denied")).toBe(false);
    expect(shouldAutoRetryFailure("retryable_error")).toBe(true);
  });

  it("backoff grows with retries", () => {
    expect(replayBackoffMs(0)).toBeLessThan(replayBackoffMs(3));
  });

  it("canAutoReplayNow respects last attempt", () => {
    expect(
      canAutoReplayNow({
        retries: 2,
        lastAttemptAt: new Date().toISOString(),
      })
    ).toBe(false);
  });
});
