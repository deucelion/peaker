import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllOfflineActions,
  enqueueOfflineAction,
  listAutoReplayCandidates,
  listOfflineActions,
} from "@/lib/offline/offlineActionQueue";
import { clearOfflineStorage } from "@/lib/offline/storage";
import { riskForKind } from "@/lib/offline/actionRegistry";
import { fieldTestSessionQueueIdempotencyKey } from "@/lib/offline/draftKeys";
import { resetOfflineQueueForTests } from "@/lib/offline/queueStore";

describe("offlineActionQueue", () => {
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
    clearAllOfflineActions();
  });

  it("enqueues safe wellness draft", () => {
    const item = enqueueOfflineAction({
      kind: "wellness_draft",
      scopeKey: scope,
      payload: { form: { fatigue: 3 } },
    });
    expect("error" in item).toBe(false);
    if ("error" in item) return;
    expect(item.status).toBe("pending");
    expect(listOfflineActions(scope)).toHaveLength(1);
  });

  it("blocks payment_record_draft", () => {
    const res = enqueueOfflineAction({
      kind: "payment_record_draft",
      scopeKey: scope,
      payload: { amount: 100 },
    });
    expect("error" in res).toBe(true);
  });

  it("marks finance note as requires_confirmation", () => {
    const item = enqueueOfflineAction({
      kind: "finance_note_draft",
      scopeKey: scope,
      payload: { note: "test" },
    });
    expect("error" in item).toBe(false);
    if ("error" in item) return;
    expect(item.status).toBe("requires_confirmation");
    expect(listAutoReplayCandidates(scope)).toHaveLength(0);
  });

  it("classifies private lesson complete as blocked", () => {
    expect(riskForKind("private_lesson_complete_draft")).toBe("blocked");
  });

  it("marks field_test_draft as requires_confirmation", () => {
    expect(riskForKind("field_test_draft")).toBe("requires_confirmation");
  });

  it("merges field test queue items per session date idempotency key", () => {
    const testDate = "2026-08-11";
    const idempotencyKey = fieldTestSessionQueueIdempotencyKey(scope, testDate);

    const first = enqueueOfflineAction({
      kind: "field_test_draft",
      scopeKey: scope,
      draftId: "draft-1",
      idempotencyKey,
      payload: {
        testDate,
        selectedProfileIds: ["athlete-1"],
        cells: [{ profileId: "athlete-1", testId: "metric-a", valueNumber: 20, editSeq: 1 }],
      },
    });
    const second = enqueueOfflineAction({
      kind: "field_test_draft",
      scopeKey: scope,
      draftId: "draft-2",
      idempotencyKey,
      payload: {
        testDate,
        selectedProfileIds: ["athlete-1"],
        cells: [{ profileId: "athlete-1", testId: "metric-a", valueNumber: 30, editSeq: 2 }],
      },
    });

    expect("error" in first).toBe(false);
    expect("error" in second).toBe(false);
    if ("error" in first || "error" in second) return;

    expect(first.id).toBe(second.id);
    expect(listOfflineActions(scope)).toHaveLength(1);
    expect(second.payload.cells).toEqual([
      { profileId: "athlete-1", testId: "metric-a", valueNumber: 30, editSeq: 2 },
    ]);
  });
});
