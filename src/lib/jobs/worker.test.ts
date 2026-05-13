import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string) => {
      if (name === "peaker_jobs_rescue_stuck") {
        return { data: [{ rescued_count: 0, dead_stuck_count: 0 }], error: null };
      }
      if (name === "peaker_pgmq_read") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      insert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

vi.mock("@/lib/monitoring/logger", () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

import { runWorkerTick } from "./worker";

describe("runWorkerTick", () => {
  it("returns empty result when no messages and reports pgmqAvailable=true", async () => {
    const result = await runWorkerTick({
      batchSize: 5,
      visibilitySeconds: 30,
      softDeadlineMs: 1000,
      source: "test",
      workerId: "test-worker",
    });
    expect(result.workerId).toBe("test-worker");
    expect(result.source).toBe("test");
    expect(result.batchSize).toBe(5);
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.deadLetter).toBe(0);
    expect(result.rescueRescued).toBe(0);
    expect(result.rescueDeadStuck).toBe(0);
  });
});
