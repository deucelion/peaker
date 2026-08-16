import { describe, expect, it } from "vitest";
import {
  shouldFailFieldTestSaveWithNoAppliedWrites,
  shouldFailFieldTestSaveWithStaleSkipsOnline,
} from "@/lib/fieldTests/fieldTestSaveIntegrity";

describe("fieldTestSaveIntegrity", () => {
  it("fails when every cell/note was skipped without a DB write", () => {
    expect(shouldFailFieldTestSaveWithNoAppliedWrites(0, 3, 0)).toBe(true);
    expect(shouldFailFieldTestSaveWithNoAppliedWrites(0, 0, 2)).toBe(true);
  });

  it("allows success when at least one write was applied", () => {
    expect(shouldFailFieldTestSaveWithNoAppliedWrites(1, 3, 0)).toBe(false);
    expect(shouldFailFieldTestSaveWithNoAppliedWrites(2, 5, 1)).toBe(false);
  });

  it("allows empty save batches without forcing failure", () => {
    expect(shouldFailFieldTestSaveWithNoAppliedWrites(0, 0, 0)).toBe(false);
  });

  it("fails online saves when any cell was stale-skipped", () => {
    expect(shouldFailFieldTestSaveWithStaleSkipsOnline(1, "online")).toBe(true);
    expect(shouldFailFieldTestSaveWithStaleSkipsOnline(3, "online")).toBe(true);
  });

  it("allows offline replay partial stale skips", () => {
    expect(shouldFailFieldTestSaveWithStaleSkipsOnline(1, "offline_replay")).toBe(false);
    expect(shouldFailFieldTestSaveWithStaleSkipsOnline(0, "online")).toBe(false);
  });
});
