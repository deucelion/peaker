import { afterEach, describe, expect, it, vi } from "vitest";
import { runProductionEnvGate } from "./productionEnvGate";

describe("runProductionEnvGate", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("no-op in non-production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.NEXT_PHASE;
    expect(() => runProductionEnvGate()).not.toThrow();
  });

  it("no-op during next production build phase", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => runProductionEnvGate()).not.toThrow();
  });

  it("throws in production when public env missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PHASE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x";
    expect(() => runProductionEnvGate()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws in production when service role missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PHASE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => runProductionEnvGate()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
