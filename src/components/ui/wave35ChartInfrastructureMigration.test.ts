import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../..");

export const WAVE35_CHART_INFRASTRUCTURE_FILES = [
  "src/lib/pdf/chartSnapshot.ts",
  "src/lib/wellness/wellnessSparkline.ts",
] as const;

export const WAVE35_CHART_INFRASTRUCTURE_ALLOWLIST_REMOVALS = [...WAVE35_CHART_INFRASTRUCTURE_FILES] as const;

const FORBIDDEN_BRANDING_HEX = ["121215", "7c3aed", "c4b5fd", "6d28d9", "09090b", "17171d"] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("FAZ 35 Wave 12 — chart infrastructure migration", () => {
  it("targets both chart helper files in the repository", () => {
    for (const file of WAVE35_CHART_INFRASTRUCTURE_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes forbidden raw branding hex from chart helpers", () => {
    for (const file of WAVE35_CHART_INFRASTRUCTURE_FILES) {
      const source = readSource(file);
      for (const hex of FORBIDDEN_BRANDING_HEX) {
        expect(source.includes(hex), `${file} must not contain raw hex ${hex}`).toBe(false);
      }
      expect(source.includes("#"), `${file} must not hardcode hex colors`).toBe(false);
    }
  });

  it("uses existing chart/content theme token infrastructure", () => {
    const chartSnapshot = readSource("src/lib/pdf/chartSnapshot.ts");
    expect(chartSnapshot).toMatch(/tableSelectors/);
    expect(chartSnapshot).toMatch(/tableSelectors\.surface/);
    expect(chartSnapshot).toMatch(/getComputedStyle/);

    const wellnessSparkline = readSource("src/lib/wellness/wellnessSparkline.ts");
    expect(wellnessSparkline).toMatch(/UI_CONTENT_THEME_VARS/);
    expect(wellnessSparkline).toMatch(/UI_CONTENT_THEME_VARS\.PRIMARY/);
  });

  it("keeps PDF snapshot browser-only and does not import DOM-only chart UI components", () => {
    const chartSnapshot = readSource("src/lib/pdf/chartSnapshot.ts");
    expect(chartSnapshot).toMatch(/captureSvgChartPng\(/);
    expect(chartSnapshot).toMatch(/document\.createElement/);
    expect(chartSnapshot).not.toMatch(/ChartFrame/);
    expect(chartSnapshot).not.toMatch(/ui-chart-shell/);
    expect(chartSnapshot).not.toMatch(/BrandingUiProvider/);
  });

  it("preserves wellness sparkline data flow and geometry", () => {
    const wellnessSparkline = readSource("src/lib/wellness/wellnessSparkline.ts");
    expect(wellnessSparkline).toMatch(/computeReadinessScore/);
    expect(wellnessSparkline).toMatch(/\.sort\(\(a, b\) => new Date\(a\.report_date\)/);
    expect(wellnessSparkline).toMatch(/\.slice\(-maxPoints\)/);
    expect(wellnessSparkline).toMatch(/maxPoints = 12/);
    expect(wellnessSparkline).toMatch(/width = 72/);
    expect(wellnessSparkline).toMatch(/height = 20/);
    expect(wellnessSparkline).toMatch(/<polyline fill="none"/);
    expect(wellnessSparkline).not.toMatch(/emerald|amber|rose|orange|red-500|green-/);
  });

  it("does not introduce new providers, primitives, or CSS namespaces", () => {
    for (const file of WAVE35_CHART_INFRASTRUCTURE_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/createContext\(/);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/ui-chart-shell/);
      expect(source).not.toMatch(/EmptyStateCard/);
    }
  });
});
