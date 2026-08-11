import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { clearOrganizationBrandingProcessCacheForTests } from "./processCache";
import { KILL_SWITCH_BRANDING_REVISION, getOrganizationBranding } from "./getOrganizationBranding";
import { resolveOrganizationBrandingForMeAccess } from "./brandingMeAccessPayload";
import type { MeAccessOrganizationBrandingPayload } from "./brandingMeAccessPayload";

vi.mock("./getOrganizationBranding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./getOrganizationBranding")>();
  return {
    ...actual,
    getOrganizationBranding: vi.fn(actual.getOrganizationBranding),
  };
});

const REQUIRED_ME_ACCESS_FIELDS = ["organizationBranding", "brandingRevision"] as const;

function isMeAccessPayload(value: unknown): value is MeAccessOrganizationBrandingPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  return REQUIRED_ME_ACCESS_FIELDS.every((field) => field in value);
}

/** CI parity gate: me-access branding payload contract for kill switch OFF. */
export function runMeAccessKillSwitchPayloadParityGate():
  | { ok: true }
  | { ok: false; message: string } {
  if (KILL_SWITCH_BRANDING_REVISION !== 0) {
    return { ok: false, message: "KILL_SWITCH_BRANDING_REVISION must be 0." };
  }
  return { ok: true };
}

/** CI parity gate: me-access payload shape with default kill-switch response. */
export async function runMeAccessPayloadContractParityGate():
  Promise<{ ok: true } | { ok: false; message: string }> {
  vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
    branding: createDefaultBranding(),
    brandingRevision: KILL_SWITCH_BRANDING_REVISION,
    source: "kill_switch",
  });

  const payload = await resolveOrganizationBrandingForMeAccess("org-contract-test");
  if (!isMeAccessPayload(payload)) {
    return { ok: false, message: "me-access payload missing required fields." };
  }
  if (payload.brandingRevision !== 0) {
    return { ok: false, message: "Kill switch OFF must expose brandingRevision 0." };
  }
  if (payload.organizationBranding.theme.primary !== "#7c3aed") {
    return { ok: false, message: "Kill switch OFF must expose default Peaker primary." };
  }
  return { ok: true };
}

describe("brandingMeAccessContract", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearOrganizationBrandingProcessCacheForTests();
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_BRANDING;
    vi.mocked(getOrganizationBranding).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("passes kill switch payload parity gate", () => {
    expect(runMeAccessKillSwitchPayloadParityGate().ok).toBe(true);
  });

  it("passes me-access payload contract parity gate", async () => {
    expect((await runMeAccessPayloadContractParityGate()).ok).toBe(true);
  });

  it("returns DB branding when kill switch runtime is ON", async () => {
    const runtimeBranding = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
      },
    });
    vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
      branding: runtimeBranding,
      brandingRevision: 5,
      source: "database",
    });

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result.brandingRevision).toBe(5);
    expect(result.organizationBranding.theme.primary).toBe("#112233");
  });
});
