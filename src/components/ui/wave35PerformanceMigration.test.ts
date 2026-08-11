import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 6 — performance & wellness migration targets */
export const WAVE35_PERFORMANCE_FILES = [
  "src/app/(dashboard)/performans/page.tsx",
  "src/app/(dashboard)/performans/ayarlar/page.tsx",
  "src/app/(dashboard)/performans/wellness-detay/page.tsx",
  "src/app/(dashboard)/performans/_components/PerformancePresentational.tsx",
  "src/components/performance/PerformanceTeamListView.tsx",
  "src/app/(dashboard)/idman-raporu/page.tsx",
  "src/app/(dashboard)/saha-testleri/genel-rapor/page.tsx",
] as const;

const RAW_SHELL_PATTERNS = [
  "bg-black/20",
  "bg-black/30",
  "border-white/10",
  "from-purple",
  "to-purple",
] as const;

const FORBIDDEN_NEUTRAL_HEX = ["121215", "7c3aed", "c4b5fd", "6d28d9", "101013", "17171d"] as const;

const SEMANTIC_WELLNESS_MARKERS = [
  "border-emerald-",
  "border-amber-",
  "border-red-",
  "text-emerald-",
  "text-amber-",
  "text-red-",
  "ui-badge-neutral",
  "ui-badge-danger",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function stripChartSemanticHex(source: string): string {
  return source
    .replace(/stopColor="var\(--peaker-ui-PRIMARY\)"/g, "")
    .replace(/stroke="var\(--peaker-ui-PRIMARY\)"/g, "")
    .replace(/fill=\{[^}]+\}/g, "");
}

function assertNoRawBrandingShells(source: string, file: string) {
  const shellSource = stripChartSemanticHex(source);
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(shellSource.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  for (const hex of FORBIDDEN_NEUTRAL_HEX) {
    expect(shellSource.includes(hex), `${file} must not contain neutral hex ${hex}`).toBe(false);
  }
}

describe("FAZ 35 Wave 6 — performance & wellness migration", () => {
  it("removes raw branding shells from all Wave 6 targets", () => {
    for (const file of WAVE35_PERFORMANCE_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses ui-card, ui-chart-shell, ChartFrame, and ChartNoData on chart surfaces", () => {
    const performans = readSource("src/app/(dashboard)/performans/page.tsx");
    expect(performans).toMatch(/ui-card-chart|ui-card/);
    expect(performans).toMatch(/ui-chart-shell/);
    expect(performans).toMatch(/ChartFrame/);
    expect(performans).toMatch(/ChartNoData/);

    const genelRapor = readSource("src/app/(dashboard)/saha-testleri/genel-rapor/page.tsx");
    expect(genelRapor).toMatch(/ui-chart-shell/);
    expect(genelRapor).toMatch(/ChartNoData/);
    expect(genelRapor).toMatch(/chartTooltipStyle/);
    expect(uiBrandingClasses.chart.shell).toBe("ui-chart-shell");
  });

  it("delegates chart empty states to ChartNoData and list empties to EmptyState", () => {
    expect(readSource("src/app/(dashboard)/performans/_components/PerformancePresentational.tsx")).toMatch(/ChartNoData/);
    expect(readSource("src/app/(dashboard)/performans/page.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/performans/wellness-detay/page.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/idman-raporu/page.tsx")).toMatch(/EmptyState/);
  });

  it("uses chartSelectors in presentational tooltips", () => {
    const presentational = readSource("src/app/(dashboard)/performans/_components/PerformancePresentational.tsx");
    expect(presentational).toMatch(/chartTooltipContentStyle|chartTooltipItemStyle/);
    expect(presentational).toMatch(/chartSelectors/);
  });

  it("uses ui-input, ui-btn, and ui-table primitives on performance surfaces", () => {
    expect(readSource("src/app/(dashboard)/performans/ayarlar/page.tsx")).toMatch(/ui-input|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/performans/wellness-detay/page.tsx")).toMatch(/ui-input/);
    expect(readSource("src/app/(dashboard)/idman-raporu/page.tsx")).toMatch(/ui-input|ui-btn-ghost/);
    expect(readSource("src/components/performance/PerformanceTeamListView.tsx")).toMatch(/ui-table-head|uiTableThClass/);
  });

  it("preserves semantic ACWR, wellness, fatigue, and field-test chart colors", () => {
    const performans = readSource("src/app/(dashboard)/performans/page.tsx");
    expect(performans).toMatch(/stopColor="var\(--peaker-ui-PRIMARY\)"/);
    expect(performans).toMatch(/stroke="var\(--peaker-ui-PRIMARY\)"/);
    expect(performans).toMatch(/fill="#22c55e"/);
    expect(performans).toMatch(/fill="#ef4444"/);
    expect(performans).toMatch(/fill="#eab308"/);

    const genelRapor = readSource("src/app/(dashboard)/saha-testleri/genel-rapor/page.tsx");
    expect(genelRapor).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    expect(genelRapor).toMatch(/color-mix\(in srgb, var\(--peaker-ui-PRIMARY\)/);

    const withSemantic = WAVE35_PERFORMANCE_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_WELLNESS_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(4);
  });
});
