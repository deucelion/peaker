import { describe, expect, it } from "vitest";
import {
  clearSavedFieldTestDirtyKeys,
  clearSavedFieldTestDirtyKeysIfUnchanged,
  incrementFieldTestDirtyGeneration,
  mergeFieldTestValuesForSave,
  reconcileFieldTestOfflineQueueCompletion,
  snapshotFieldTestDirtyGenerations,
} from "./fieldTestSaveSnapshot";

describe("mergeFieldTestValuesForSave", () => {
  it("prefers latest ref values over stale closure state", () => {
    const merged = mergeFieldTestValuesForSave(
      { "p1-m1": "10", "p1-m2": "old" },
      { "p1-m1": "12.5" }
    );
    expect(merged["p1-m1"]).toBe("12.5");
    expect(merged["p1-m2"]).toBe("old");
  });
});

describe("clearSavedFieldTestDirtyKeys", () => {
  it("clears only keys included in the successful save batch", () => {
    const dirtyCells = new Set(["p1-m1", "p1-m2"]);
    const dirtyNotes = new Set(["p1", "p2"]);
    clearSavedFieldTestDirtyKeys(dirtyCells, dirtyNotes, new Set(["p1-m1"]), ["p1"]);
    expect(dirtyCells).toEqual(new Set(["p1-m2"]));
    expect(dirtyNotes).toEqual(new Set(["p2"]));
  });
});

describe("clearSavedFieldTestDirtyKeysIfUnchanged", () => {
  it("does not clear keys edited after save started", () => {
    const dirtyCells = new Set(["p1-m1"]);
    const currentGenerations = new Map([["p1-m1", 2]]);
    const generationsAtSave = snapshotFieldTestDirtyGenerations(new Set(["p1-m1"]), new Map([["p1-m1", 1]]));

    clearSavedFieldTestDirtyKeysIfUnchanged(
      dirtyCells,
      new Set(),
      new Set(["p1-m1"]),
      [],
      generationsAtSave,
      new Map(),
      currentGenerations,
      new Map()
    );

    expect(dirtyCells).toEqual(new Set(["p1-m1"]));
  });

  it("clears keys when generation is unchanged after save", () => {
    const dirtyCells = new Set(["p1-m1"]);
    const generations = new Map([["p1-m1", 1]]);

    clearSavedFieldTestDirtyKeysIfUnchanged(
      dirtyCells,
      new Set(),
      new Set(["p1-m1"]),
      [],
      snapshotFieldTestDirtyGenerations(new Set(["p1-m1"]), generations),
      new Map(),
      generations,
      new Map()
    );

    expect(dirtyCells.size).toBe(0);
  });
});

describe("reconcileFieldTestOfflineQueueCompletion", () => {
  it("clears dirty keys only after queue item disappears and generation matches", () => {
    const dirtyCells = new Set(["p1-m1"]);
    const generations = new Map([["p1-m1", 1]]);

    const remaining = reconcileFieldTestOfflineQueueCompletion(
      [
        {
          queueItemId: "q1",
          cellKeys: new Set(["p1-m1"]),
          noteProfileIds: [],
          cellGenerationsAtQueue: snapshotFieldTestDirtyGenerations(new Set(["p1-m1"]), generations),
          noteGenerationsAtQueue: new Map(),
        },
      ],
      new Set(),
      dirtyCells,
      new Set(),
      generations,
      new Map()
    );

    expect(remaining).toEqual([]);
    expect(dirtyCells.size).toBe(0);
  });

  it("keeps dirty keys when user edited after queue enqueue", () => {
    const dirtyCells = new Set(["p1-m1"]);
    const atQueue = new Map([["p1-m1", 1]]);
    const current = new Map([["p1-m1", 2]]);

    reconcileFieldTestOfflineQueueCompletion(
      [
        {
          queueItemId: "q1",
          cellKeys: new Set(["p1-m1"]),
          noteProfileIds: [],
          cellGenerationsAtQueue: snapshotFieldTestDirtyGenerations(new Set(["p1-m1"]), atQueue),
          noteGenerationsAtQueue: new Map(),
        },
      ],
      new Set(),
      dirtyCells,
      new Set(),
      current,
      new Map()
    );

    expect(dirtyCells).toEqual(new Set(["p1-m1"]));
  });

  it("retains batches still present in the offline queue", () => {
    const batch = {
      queueItemId: "q1",
      cellKeys: new Set(["p1-m1"]),
      noteProfileIds: [] as string[],
      cellGenerationsAtQueue: new Map([["p1-m1", 1]]),
      noteGenerationsAtQueue: new Map<string, number>(),
    };

    const remaining = reconcileFieldTestOfflineQueueCompletion(
      [batch],
      new Set(["q1"]),
      new Set(["p1-m1"]),
      new Set(),
      new Map([["p1-m1", 1]]),
      new Map()
    );

    expect(remaining).toHaveLength(1);
  });
});

describe("incrementFieldTestDirtyGeneration", () => {
  it("increments per key independently", () => {
    const map = new Map<string, number>();
    expect(incrementFieldTestDirtyGeneration(map, "a")).toBe(1);
    expect(incrementFieldTestDirtyGeneration(map, "a")).toBe(2);
    expect(incrementFieldTestDirtyGeneration(map, "b")).toBe(1);
  });
});
