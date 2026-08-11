import { describe, expect, it } from "vitest";
import {
  hasFieldTestPendingSave,
  shouldDeferFieldTestAutosave,
  shouldFlushFieldTestAfterSave,
  shouldPreserveLocalFieldTestValuesOnFetch,
  shouldSkipFieldTestAutosave,
} from "./fieldTestAutosave";

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

  it("defers autosave during in-flight save when work remains", () => {
    expect(
      shouldDeferFieldTestAutosave({
        saveInFlight: true,
        dirtyCellKeys: new Set(["p1-m1"]),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(true);

    expect(
      shouldDeferFieldTestAutosave({
        saveInFlight: true,
        dirtyCellKeys: new Set(),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(false);
  });

  it("requests post-save flush when defer was requested or dirty keys remain", () => {
    expect(
      shouldFlushFieldTestAfterSave({
        pendingFlushRequested: true,
        dirtyCellKeys: new Set(),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(true);

    expect(
      shouldFlushFieldTestAfterSave({
        pendingFlushRequested: false,
        dirtyCellKeys: new Set(["p1-m2"]),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(true);

    expect(
      shouldFlushFieldTestAfterSave({
        pendingFlushRequested: false,
        dirtyCellKeys: new Set(),
        dirtyNoteProfileIds: new Set(),
      })
    ).toBe(false);
  });

  it("preserves local values during queued/saving/dirty/error fetch hydration", () => {
    expect(shouldPreserveLocalFieldTestValuesOnFetch("queued")).toBe(true);
    expect(shouldPreserveLocalFieldTestValuesOnFetch("saving")).toBe(true);
    expect(shouldPreserveLocalFieldTestValuesOnFetch("dirty")).toBe(true);
    expect(shouldPreserveLocalFieldTestValuesOnFetch("error")).toBe(true);
    expect(shouldPreserveLocalFieldTestValuesOnFetch("saved")).toBe(false);
    expect(shouldPreserveLocalFieldTestValuesOnFetch("idle")).toBe(false);
  });
});
