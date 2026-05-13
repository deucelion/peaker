import { describe, it, expect } from "vitest";
import { createUpstashAdapter } from "./upstashAdapter";

describe("createUpstashAdapter", () => {
  it("returns null when ENV vars missing", () => {
    const adapter = createUpstashAdapter({ url: undefined, token: undefined });
    expect(adapter).toBeNull();
  });

  it("makes POST to upstash with EVAL and parses success response", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    let capturedHeaders: Record<string, string> = {};
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body || "");
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(JSON.stringify({ result: [1, 4, 0] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const adapter = createUpstashAdapter({
      url: "https://example.upstash.io",
      token: "tok-123",
      fetchImpl: fakeFetch,
    });
    expect(adapter).not.toBeNull();
    const decision = await adapter!.check("user:1", { capacity: 5, windowMs: 60_000 });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.remaining).toBe(4);
    expect(capturedUrl).toBe("https://example.upstash.io");
    expect(capturedHeaders.Authorization).toBe("Bearer tok-123");
    expect(capturedBody).toContain("EVAL");
    expect(capturedBody).toContain("peaker:rl:user:1");
  });

  it("parses denial response with retry_after_ms", async () => {
    const fakeFetch = (async () => {
      return new Response(JSON.stringify({ result: [0, 0, 1500] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const adapter = createUpstashAdapter({
      url: "https://example.upstash.io",
      token: "tok",
      fetchImpl: fakeFetch,
    });
    const decision = await adapter!.check("user:2", { capacity: 5, windowMs: 60_000 });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.retryAfterMs).toBe(1500);
  });

  it("throws on HTTP error", async () => {
    const fakeFetch = (async () => {
      return new Response("Unauthorized", { status: 401 });
    }) as unknown as typeof fetch;

    const adapter = createUpstashAdapter({
      url: "https://example.upstash.io",
      token: "wrong",
      fetchImpl: fakeFetch,
    });
    await expect(adapter!.check("user:3", { capacity: 1, windowMs: 60_000 })).rejects.toThrow(
      /upstash http 401/
    );
  });

  it("throws when Upstash returns error field", async () => {
    const fakeFetch = (async () => {
      return new Response(JSON.stringify({ error: "WRONGTYPE" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const adapter = createUpstashAdapter({
      url: "https://example.upstash.io",
      token: "tok",
      fetchImpl: fakeFetch,
    });
    await expect(adapter!.check("k", { capacity: 1, windowMs: 60_000 })).rejects.toThrow(
      /upstash eval error/
    );
  });
});
