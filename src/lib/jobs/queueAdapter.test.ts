import { describe, it, expect } from "vitest";
import {
  inMemoryAdapter,
  getQueueAdapter,
  jobContextToQueuePayload,
  decideRetry,
} from "./queueAdapter";
import { createJobContext } from "./createJobContext";

describe("queueAdapter — inMemoryAdapter", () => {
  it("enqueue returns enqueued with derived jobId", async () => {
    const res = await inMemoryAdapter.enqueue({
      kind: "export.performance",
      payload: { foo: "bar" },
    });
    expect(res.status).toBe("enqueued");
    if (res.status === "enqueued") expect(res.jobId).toBeTruthy();
  });

  it("enqueue uses idempotencyKey when provided", async () => {
    const res = await inMemoryAdapter.enqueue({
      kind: "retention.notifications",
      idempotencyKey: "abc-123",
      payload: {},
    });
    expect(res.status).toBe("enqueued");
    if (res.status === "enqueued") expect(res.jobId).toBe("abc-123");
  });

  it("cancel returns not_found", async () => {
    const res = await inMemoryAdapter.cancel("unknown");
    expect(res.status).toBe("not_found");
  });
});

describe("queueAdapter — registry", () => {
  it("default adapter is in-memory", () => {
    expect(getQueueAdapter().name).toBe("in-memory");
  });
});

describe("jobContextToQueuePayload", () => {
  it("serializes ctx into payload shape", () => {
    const ctx = createJobContext({
      kind: "export.audit",
      initiator: { kind: "user", id: "u1", role: "admin" },
      organizationId: "org-1",
      attributes: { dateFrom: "2026-01-01" },
    });
    const payload = jobContextToQueuePayload(ctx, {
      retry: { maxAttempts: 3, backoffMs: 1000 },
      deadLetterThreshold: 5,
    });
    expect(payload.kind).toBe("export.audit");
    expect(payload.idempotencyKey).toBe(ctx.jobId);
    expect(payload.payload.organizationId).toBe("org-1");
    expect(payload.retry?.maxAttempts).toBe(3);
    expect(payload.deadLetterThreshold).toBe(5);
  });
});

describe("decideRetry", () => {
  it("permission_denied is no_retry", () => {
    const decision = decideRetry("permission_denied", { attempt: 1, maxAttempts: 3, baseBackoffMs: 1000 });
    expect(decision.shouldRetry).toBe(false);
  });

  it("transient_fetch is retry_safe with exponential backoff", () => {
    const a1 = decideRetry("transient_fetch", { attempt: 1, maxAttempts: 3, baseBackoffMs: 1000 });
    expect(a1.shouldRetry).toBe(true);
    expect(a1.nextDelayMs).toBe(1000);
    const a2 = decideRetry("transient_fetch", { attempt: 2, maxAttempts: 3, baseBackoffMs: 1000 });
    expect(a2.nextDelayMs).toBe(2000);
    const a3 = decideRetry("transient_fetch", { attempt: 3, maxAttempts: 3, baseBackoffMs: 1000 });
    expect(a3.shouldRetry).toBe(false);
  });

  it("fetch_error is idempotent-only retry", () => {
    const d = decideRetry("fetch_error", { attempt: 1, maxAttempts: 3, baseBackoffMs: 500 });
    expect(d.shouldRetry).toBe(true);
  });

  it("unknown kind defaults to no_retry", () => {
    const d = decideRetry(undefined, { attempt: 1, maxAttempts: 3, baseBackoffMs: 500 });
    expect(d.shouldRetry).toBe(false);
  });
});
