import { describe, it, expect } from "vitest";
import { createPostgresAdapter } from "./postgresAdapter";
import type { SupabaseClient } from "@supabase/supabase-js";

type RpcArgs = { p_key: string; p_capacity: number; p_window_ms: number };

function makeFakeClient(rpcImpl: (name: string, args: RpcArgs) => unknown): SupabaseClient {
  return {
    rpc: rpcImpl,
  } as unknown as SupabaseClient;
}

describe("createPostgresAdapter", () => {
  it("parses 'allowed=true' result row", async () => {
    const client = makeFakeClient((name, args) => {
      expect(name).toBe("peaker_rate_limit_check");
      expect(args.p_key).toBe("user:1");
      expect(args.p_capacity).toBe(5);
      expect(args.p_window_ms).toBe(60_000);
      return { data: [{ allowed: true, remaining: 3, retry_after_ms: 0 }], error: null };
    });
    const adapter = createPostgresAdapter({ client });
    const decision = await adapter.check("user:1", { capacity: 5, windowMs: 60_000 });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.remaining).toBe(3);
  });

  it("parses denial with retry_after_ms", async () => {
    const client = makeFakeClient(() => ({
      data: [{ allowed: false, remaining: 0, retry_after_ms: 2500 }],
      error: null,
    }));
    const adapter = createPostgresAdapter({ client });
    const decision = await adapter.check("user:1", { capacity: 5, windowMs: 60_000 });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.retryAfterMs).toBe(2500);
  });

  it("supports boolean string 'true' for allowed (jsonb edge case)", async () => {
    const client = makeFakeClient(() => ({
      data: [{ allowed: "true", remaining: 1, retry_after_ms: 0 }],
      error: null,
    }));
    const adapter = createPostgresAdapter({ client });
    const decision = await adapter.check("k", { capacity: 1, windowMs: 60_000 });
    expect(decision.allowed).toBe(true);
  });

  it("throws on RPC error", async () => {
    const client = makeFakeClient(() => ({
      data: null,
      error: { message: "function not found" },
    }));
    const adapter = createPostgresAdapter({ client });
    await expect(adapter.check("k", { capacity: 1, windowMs: 60_000 })).rejects.toThrow(
      /function not found/
    );
  });

  it("throws on empty result", async () => {
    const client = makeFakeClient(() => ({ data: [], error: null }));
    const adapter = createPostgresAdapter({ client });
    await expect(adapter.check("k", { capacity: 1, windowMs: 60_000 })).rejects.toThrow(
      /empty/
    );
  });
});
