import { describe, expect, it } from "vitest";
import { bumpClientRealtimeStat, getClientRealtimeStatsSnapshot, resetClientRealtimeStats } from "./clientRealtimeStats";

describe("clientRealtimeStats", () => {
  it("bumps counters and reset clears", () => {
    resetClientRealtimeStats();
    bumpClientRealtimeStat("notificationFetch", 2);
    bumpClientRealtimeStat("financeInvalidate");
    const s = getClientRealtimeStatsSnapshot();
    expect(s.notificationFetch).toBe(2);
    expect(s.financeInvalidate).toBe(1);
    resetClientRealtimeStats();
    expect(getClientRealtimeStatsSnapshot().notificationFetch).toBe(0);
  });
});
