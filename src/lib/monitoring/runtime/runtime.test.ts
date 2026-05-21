import { beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeTrackersForTests, trackOfflineReplayFailure } from "@/lib/monitoring/runtime";

describe("runtime trackers", () => {
  beforeEach(() => {
    resetRuntimeTrackersForTests();
  });

  it("tracks offline replay failures without throwing", () => {
    expect(() =>
      trackOfflineReplayFailure({ kind: "wellness_draft", failureKind: "conflict" })
    ).not.toThrow();
  });
});
