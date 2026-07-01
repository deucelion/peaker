import { describe, expect, it } from "vitest";
import { hasFieldTestPendingSave, shouldSkipFieldTestAutosave } from "./fieldTestAutosave";

describe("fieldTestAutosave", () => {
  it("detects pending dirty cells or notes", () => {
    expect(hasFieldTestPendingSave(new Set(), new Set())).toBe(false);
    expect(hasFieldTestPendingSave(new Set(["p1-m1"]), new Set())).toBe(true);
    expect(hasFieldTestPendingSave(new Set(), new Set(["p1"]))).toBe(true);
  });

  it("skips autosave while saving or when nothing is dirty", () => {
    expect(
      shouldSkipFieldTestAutosave({
        saveInFlight: true,
        saveLoading: false,
        dirtyCellKeys: new Set(["p1-m1"]),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(true);

    expect(
      shouldSkipFieldTestAutosave({
        saveInFlight: false,
        saveLoading: false,
        dirtyCellKeys: new Set(),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(true);

    expect(
      shouldSkipFieldTestAutosave({
        saveInFlight: false,
        saveLoading: false,
        dirtyCellKeys: new Set(["p1-m1"]),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(false);
  });
});
