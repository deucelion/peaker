import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertKillSwitchDefaultOff,
  BRANDING_STORYBOOK_CATALOG_FILES,
  DOCUMENTED_CUMULATIVE_SURFACE_COVERAGE_PERCENT,
  runAllowlistStructureGate,
  runBrandingCoverageAudit,
  runBrandingCoverageGate,
  runBrandingParityCheck,
  runMeAccessCallSiteGate,
  runRawColorAllowlistGate,
  runStorybookCatalogGate,
  runWave14ProductionValidation,
} from "./branding-parity-check";

const ROOT = process.cwd();
const BENCHMARKS_CSV = join(ROOT, "docs/branding/benchmarks/wave14-results.csv");

describe("Wave 14 production branding validation", () => {
  it("runs strict allowlist gate with documented exception categories", () => {
    expect(runRawColorAllowlistGate().ok).toBe(true);
    expect(runAllowlistStructureGate().ok).toBe(true);
  });

  it("documents cumulative surface coverage in the 50–60% band", () => {
    const coverage = runBrandingCoverageGate();
    expect(coverage.ok).toBe(true);
    expect(DOCUMENTED_CUMULATIVE_SURFACE_COVERAGE_PERCENT).toBeGreaterThanOrEqual(50);
    expect(DOCUMENTED_CUMULATIVE_SURFACE_COVERAGE_PERCENT).toBeLessThanOrEqual(60);
    expect(runBrandingCoverageAudit().migratedOffAllowlist).toBe(144);
  });

  it("verifies Storybook catalog completeness for waves 5–13", () => {
    expect(runStorybookCatalogGate().ok).toBe(true);
    expect(BRANDING_STORYBOOK_CATALOG_FILES.length).toBe(13);
  });

  it("limits fetchMeAccessClient production call sites", () => {
    expect(runMeAccessCallSiteGate().ok).toBe(true);
  });

  it("loads signed-off performance benchmark results", () => {
    const csv = readFileSync(BENCHMARKS_CSV, "utf8");
    expect(csv).toMatch(/me-access per session/);
    expect(csv).toMatch(/LCP/);
    expect(csv).toMatch(/CLS/);
    expect(csv).toMatch(/PASS/);
  });

  it("includes E2E branding suite entry points", () => {
    expect(readFileSync(join(ROOT, "e2e/branding/white-label.spec.ts"), "utf8")).toMatch(
      /data-peaker-ui-content-root/
    );
    expect(readFileSync(join(ROOT, "e2e/branding/kill-switch.spec.ts"), "utf8")).toMatch(
      /brandingRevision/
    );
  });

  it("includes production rollout runbook", () => {
    const runbook = readFileSync(join(ROOT, "docs/branding/runbooks/production-rollout.md"), "utf8");
    expect(runbook).toMatch(/PEAKER_ORG_BRANDING/);
    expect(runbook).toMatch(/Wave 14/);
    expect(runbook).toMatch(/rollback/i);
  });

  it("runs full Wave 14 production validation without throwing", () => {
    expect(() => runWave14ProductionValidation()).not.toThrow();
  });
});

describe("scripts/branding-parity-check (Wave 14 strict)", () => {
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
