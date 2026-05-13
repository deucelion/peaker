import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runJobsRetention } from "./jobsRetentionHealth";

function mockClient(rpcImpl: (...args: unknown[]) => unknown): SupabaseClient {
  return {
    rpc: vi.fn(rpcImpl as never),
  } as unknown as SupabaseClient;
}

describe("runJobsRetention", () => {
  it("returns ok with aggregated totals when RPC succeeds", async () => {
    const client = mockClient(() =>
      Promise.resolve({
        data: [
          { scope: "terminal", removed_count: 12 },
          { scope: "failed", removed_count: 3 },
          { scope: "heartbeat", removed_count: 50 },
          { scope: "archive", removed_count: 7 },
        ],
        error: null,
      })
    );
    const res = await runJobsRetention(client);
    expect(res.ok).toBe(true);
    expect(res.removedByScope.terminal).toBe(12);
    expect(res.removedByScope.failed).toBe(3);
    expect(res.removedByScope.heartbeat).toBe(50);
    expect(res.removedByScope.archive).toBe(7);
    expect(res.totals.totalRemoved).toBe(72);
    expect(res.totals.terminalDays).toBe(30);
    expect(res.totals.failedDays).toBe(90);
    expect(res.totals.heartbeatDays).toBe(7);
    expect(res.totals.archiveDays).toBe(60);
  });

  it("clamps below-minimum overrides back to defaults", async () => {
    const client = mockClient(() => Promise.resolve({ data: [], error: null }));
    const res = await runJobsRetention(client, {
      terminalDays: 1,
      failedDays: 5,
      heartbeatDays: 0,
      archiveDays: 2,
    });
    expect(res.totals.terminalDays).toBe(30);
    expect(res.totals.failedDays).toBe(90);
    expect(res.totals.heartbeatDays).toBe(7);
    expect(res.totals.archiveDays).toBe(60);
  });

  it("returns ok=false with error when RPC fails", async () => {
    const client = mockClient(() =>
      Promise.resolve({ data: null, error: { message: "boom" } })
    );
    const res = await runJobsRetention(client);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("boom");
    expect(res.totals.totalRemoved).toBe(0);
  });

  it("handles non-array data gracefully", async () => {
    const client = mockClient(() => Promise.resolve({ data: null, error: null }));
    const res = await runJobsRetention(client);
    expect(res.ok).toBe(true);
    expect(res.totals.totalRemoved).toBe(0);
  });
});
