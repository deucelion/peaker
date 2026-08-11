import { describe, expect, it } from "vitest";
import {
  assertKillSwitchDefaultOff,
  runBrandingParityCheck,
  runRawColorAllowlistGate,
} from "./branding-parity-check";

describe("scripts/branding-parity-check", () => {
  it("asserts kill switch defaults to OFF", () => {
    expect(() => assertKillSwitchDefaultOff()).not.toThrow();
  });

  it("passes raw color allowlist inventory gate", () => {
    const result = runRawColorAllowlistGate();
    expect(result.ok, result.ok ? undefined : result.message).toBe(true);
  });

  it("runs strict branding parity check without throwing", () => {
    expect(() => runBrandingParityCheck({ strict: true })).not.toThrow();
  });
});
