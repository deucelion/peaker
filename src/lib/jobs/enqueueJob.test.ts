import { describe, it, expect, beforeEach } from "vitest";
import { enqueueJob } from "./enqueueJob";
import {
  registerQueueAdapter,
  inMemoryAdapter,
  type QueueAdapter,
} from "./queueAdapter";
import { createJobContext } from "./createJobContext";

describe("enqueueJob — adapter integration", () => {
  beforeEach(() => {
    registerQueueAdapter(inMemoryAdapter);
  });

  it("default adapter returns enqueued", async () => {
    const ctx = createJobContext({
      kind: "export.audit",
      initiator: { kind: "user", id: "u1", role: "admin" },
      organizationId: "org-1",
    });
    const res = await enqueueJob(ctx);
    expect(res.status).toBe("enqueued");
  });

  it("duplicate adapter result is propagated", async () => {
    const dupe: QueueAdapter = {
      name: "test-duplicate",
      async enqueue() {
        return { status: "duplicate", jobId: "abc" };
      },
      async cancel() {
        return { status: "not_found" };
      },
    };
    registerQueueAdapter(dupe);
    const ctx = createJobContext({
      kind: "retention.notifications",
      initiator: { kind: "system", id: "scheduler" },
    });
    const res = await enqueueJob(ctx);
    expect(res.status).toBe("duplicate");
    if (res.status === "duplicate") expect(res.jobId).toBe("abc");
  });

  it("rejected adapter result is propagated", async () => {
    const broken: QueueAdapter = {
      name: "broken",
      async enqueue() {
        return { status: "rejected", reason: "pgmq not installed" };
      },
      async cancel() {
        return { status: "not_found" };
      },
    };
    registerQueueAdapter(broken);
    const ctx = createJobContext({
      kind: "export.payments",
      initiator: { kind: "user", id: "u1", role: "admin" },
    });
    const res = await enqueueJob(ctx);
    expect(res.status).toBe("rejected");
    if (res.status === "rejected") expect(res.reason).toBe("pgmq not installed");
  });
});
