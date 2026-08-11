import { describe, expect, it } from "vitest";
import {
  FIELD_TEST_DRAFT_UNSYNCED_MARKER,
  fieldTestDraftHasContent,
  shouldPersistFieldTestDraft,
  shouldRestoreFieldTestDraft,
} from "@/lib/fieldTests/fieldTestDraftLifecycle";

const SESSION = "2026-08-11";

function draft(overrides: Record<string, unknown> = {}) {
  return {
    testDate: SESSION,
    [FIELD_TEST_DRAFT_UNSYNCED_MARKER]: true,
    testValues: { "p1-sprint": "1.85" },
    generalNotes: {},
    ...overrides,
  };
}

describe("shouldPersistFieldTestDraft", () => {
  it("persists while there is unsynced work", () => {
    for (const saveFeedback of ["dirty", "queued", "error"] as const) {
      expect(shouldPersistFieldTestDraft({ saveFeedback, hasPendingSave: false })).toBe(true);
    }
    expect(shouldPersistFieldTestDraft({ saveFeedback: "idle", hasPendingSave: true })).toBe(true);
  });

  /**
   * Regression: hydrate edilmiş DB değerleri taslağa yazılırsa, sonraki açılışta
   * taslak DB'yi ezip formu kalıcı `dirty` durumuna kilitliyordu.
   */
  it("does not persist purely hydrated state", () => {
    for (const saveFeedback of ["idle", "saving", "saved"] as const) {
      expect(shouldPersistFieldTestDraft({ saveFeedback, hasPendingSave: false })).toBe(false);
    }
  });
});

describe("fieldTestDraftHasContent", () => {
  it("detects values and notes", () => {
    expect(fieldTestDraftHasContent({ "p1-sprint": "1.85" }, {})).toBe(true);
    expect(fieldTestDraftHasContent({}, { p1: "yorgun" })).toBe(true);
    expect(fieldTestDraftHasContent({ "p1-sprint": 0 }, {})).toBe(true);
  });

  it("treats empty/blank payloads as contentless", () => {
    expect(fieldTestDraftHasContent({}, {})).toBe(false);
    expect(fieldTestDraftHasContent({ "p1-sprint": "" }, { p1: "   " })).toBe(false);
    expect(fieldTestDraftHasContent(undefined, undefined)).toBe(false);
    expect(fieldTestDraftHasContent(null, null)).toBe(false);
  });
});

describe("shouldRestoreFieldTestDraft", () => {
  it("restores a genuine unsynced draft for the same session date", () => {
    expect(shouldRestoreFieldTestDraft({ payload: draft(), sessionDate: SESSION })).toBe(true);
  });

  it("ignores a draft from another session date", () => {
    expect(
      shouldRestoreFieldTestDraft({ payload: draft({ testDate: "2026-08-10" }), sessionDate: SESSION })
    ).toBe(false);
  });

  /**
   * Regression: bugün kaydedilen ölçümler, cihazda kalmış BOŞ taslak yüzünden
   * hydrate sonrası siliniyor ve düzenlenemez hale geliyordu.
   */
  it("ignores an empty draft so saved measurements survive hydration", () => {
    expect(
      shouldRestoreFieldTestDraft({
        payload: draft({ testValues: {}, generalNotes: {} }),
        sessionDate: SESSION,
      })
    ).toBe(false);
    expect(
      shouldRestoreFieldTestDraft({
        payload: draft({ testValues: { "p1-sprint": "" }, generalNotes: {} }),
        sessionDate: SESSION,
      })
    ).toBe(false);
  });

  it("ignores legacy hydration-copy drafts that carry no unsynced marker", () => {
    const legacy = draft();
    delete (legacy as Record<string, unknown>)[FIELD_TEST_DRAFT_UNSYNCED_MARKER];
    expect(shouldRestoreFieldTestDraft({ payload: legacy, sessionDate: SESSION })).toBe(false);
  });

  it("ignores missing payloads", () => {
    expect(shouldRestoreFieldTestDraft({ payload: null, sessionDate: SESSION })).toBe(false);
    expect(shouldRestoreFieldTestDraft({ payload: undefined, sessionDate: SESSION })).toBe(false);
  });
});
