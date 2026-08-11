import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOrganizationBrandingRuntimeEnabled } from "./killSwitch";

describe("organization branding kill switch", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_BRANDING;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("remains OFF when PEAKER_ORG_BRANDING is unset", () => {
    expect(isOrganizationBrandingRuntimeEnabled()).toBe(false);
  });

  it("remains OFF for empty and false-like values", () => {
    for (const value of ["", "0", "false", "no", "off", "disabled"]) {
      vi.stubEnv("PEAKER_ORG_BRANDING", value);
      expect(isOrganizationBrandingRuntimeEnabled()).toBe(false);
    }
  });

  it("enables runtime branding for truthy staging values", () => {
    for (const value of ["1", "true", "yes", "on", " TRUE "]) {
      vi.stubEnv("PEAKER_ORG_BRANDING", value);
      expect(isOrganizationBrandingRuntimeEnabled()).toBe(true);
    }
  });
});

/** CI parity gate: kill switch must default to OFF. */
export function runKillSwitchDefaultOffParityGate():
  | { ok: true }
  | { ok: false; message: string } {
  const previous = process.env.PEAKER_ORG_BRANDING;
  delete process.env.PEAKER_ORG_BRANDING;
  const enabled = isOrganizationBrandingRuntimeEnabled();
  if (previous === undefined) {
    delete process.env.PEAKER_ORG_BRANDING;
  } else {
    process.env.PEAKER_ORG_BRANDING = previous;
  }
  if (enabled) {
    return { ok: false, message: "PEAKER_ORG_BRANDING must default to OFF." };
  }
  return { ok: true };
}
