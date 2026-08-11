import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../../..");

/** Wave 12 migration targets — see docs/branding/wave-12.md */
export const WAVE12_CHART_FILES = [
  "src/app/(dashboard)/performans/page.tsx",
  "src/app/(dashboard)/performans/_components/PerformancePresentational.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthletePerformanceHero.tsx",
  "src/app/(dashboard)/sporcu/[id]/AthletePerformanceInsightsPanel.tsx",
  "src/app/(dashboard)/sistem-operasyonlari/page.tsx",
  "src/app/(dashboard)/saha-testleri/genel-rapor/page.tsx",
  "src/components/PerformanceRadar.tsx",
  "src/components/athlete/AthleteBodyMeasurementSection.tsx",
  "src/components/ui/charts/ChartFrame.tsx",
  "src/components/ui/data-display/ChartNoData.tsx",
  "src/lib/pdf/pdfCommon.ts",
  "src/lib/email/emailTemplateBranding.ts",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("Wave 12 chart & export migration", () => {
  it("decouples ChartFrame empty state from athlete detail primitives", () => {
    const frame = readSource("src/components/ui/charts/ChartFrame.tsx");
    expect(frame).toMatch(/ChartNoData/);
    expect(frame).not.toMatch(/AthleteDetailPrimitives/);
    expect(frame).toMatch(/ui-chart-shell/);
  });

  it("uses token-bound ChartNoData shell", () => {
    expect(readSource("src/components/ui/data-display/ChartNoData.tsx")).toMatch(/ui-chart-no-data/);
    expect(readSource("src/app/(dashboard)/globals.css")).toMatch(/\.ui-chart-no-data/);
    expect(uiBrandingClasses.chart.noData).toBe("ui-chart-no-data");
  });

  it("migrates custom performance tooltips off raw chart shell hex", () => {
    const presentational = readSource("src/app/(dashboard)/performans/_components/PerformancePresentational.tsx");
    expect(presentational).toMatch(/chartTooltipContentStyle/);
    expect(presentational.includes("1c1c21")).toBe(false);
  });

  it("uses chartSelectors on field test report bar chart", () => {
    const report = readSource("src/app/(dashboard)/saha-testleri/genel-rapor/page.tsx");
    expect(report).toMatch(/chartTooltipStyle/);
    expect(report).toMatch(/ui-chart-shell/);
    expect(report.includes("1c1c21")).toBe(false);
  });

  it("uses chartTooltipStyle on athlete body measurement chart", () => {
    const section = readSource("src/components/athlete/AthleteBodyMeasurementSection.tsx");
    expect(section).toMatch(/chartTooltipStyle/);
    expect(section.includes("1c1c21")).toBe(false);
  });

  it("tokenizes PerformanceRadar shell surfaces", () => {
    const radar = readSource("src/components/PerformanceRadar.tsx");
    expect(radar).toMatch(/uiBrandingClasses\.chart\.shell/);
    expect(uiBrandingClasses.chart.shell).toBe("ui-chart-shell");
    expect(radar.includes("121215")).toBe(false);
  });

  it("replaces pdfCommon hardcoded brand header rgb with snapshot primary", () => {
    const pdfCommon = readSource("src/lib/pdf/pdfCommon.ts");
    expect(pdfCommon).not.toMatch(/BRAND_COLOR/);
    expect(pdfCommon).toMatch(/headerColorRgb/);
  });

  it("aligns email template header with organization primary", () => {
    const email = readSource("src/lib/email/emailTemplateBranding.ts");
    expect(email).toMatch(/renderEmailTemplateHeaderBackground/);
    expect(email).toMatch(/presentation\.headerColor/);
  });

  it("preserves semantic chart series colors in performance pdf", () => {
    const performancePdf = readSource("src/lib/pdf/performancePdf.ts");
    expect(performancePdf).toMatch(/\[245, 158, 11\]/);
    expect(performancePdf).toMatch(/optimalBand/);
  });
});
