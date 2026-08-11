import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 1 — primitive completion targets */
export const WAVE35_PRIMITIVE_FILES = [
  "src/components/ui/layout/FilterBar.tsx",
  "src/components/ui/layout/PageHeader.tsx",
  "src/components/compact/CompactListRow.tsx",
  "src/components/compact/CompactTimelineItem.tsx",
  "src/components/PerformanceRadar.tsx",
] as const;

const REMOVED_PRIMITIVE_FILE = "src/app/(dashboard)/sporcu/[id]/_components/AthleteDetailPrimitives.tsx";

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawNeutralHex(source: string, file: string) {
  for (const hex of ["121215", "7c3aed"] as const) {
    expect(source.includes(hex), `${file} must not contain raw neutral hex`).toBe(false);
  }
}

describe("FAZ 35 Wave 1 — primitive completion", () => {
  it("removes AthleteDetailPrimitives duplicate implementations", () => {
    expect(existsSync(join(REPO_ROOT, REMOVED_PRIMITIVE_FILE))).toBe(false);

    const statusBar = readSource(
      "src/app/(dashboard)/sporcu/[id]/_components/AthleteCriticalStatusBar.tsx"
    );
    expect(statusBar).not.toMatch(/AthleteDetailPrimitives/);
    expect(statusBar).not.toMatch(/\bQuickStat\b/);
    expect(statusBar).toMatch(/uiBrandingClasses\.kpi\.card/);

    const profileForm = readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteProfileForm.tsx");
    expect(profileForm).not.toMatch(/AthleteDetailPrimitives/);
    expect(profileForm).not.toMatch(/\bMetricBadge\b/);
    expect(profileForm).toMatch(/ui-kpi-chip|uiBrandingClasses\.kpi\.chip/);
  });

  it("finishes FilterBar migration with ui-toolbar and kpi section shells", () => {
    const filterBar = readSource("src/components/ui/layout/FilterBar.tsx");
    expect(filterBar).toMatch(/uiBrandingClasses\.layout\.toolbar/);
    expect(filterBar).toMatch(/uiBrandingClasses\.kpi\.(section|band)/);
    expect(filterBar).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    assertNoRawNeutralHex(filterBar, "FilterBar.tsx");
  });

  it("finishes PageHeader migration without local tab chrome", () => {
    const header = readSource("src/components/ui/layout/PageHeader.tsx");
    expect(header).toMatch(/UiTabsNav/);
    expect(header).toMatch(/uiBrandingClasses\.typography\.(h1|lead)/);
    expect(header).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    expect(header).not.toMatch(/border-white\/10.*tab|tab.*border-white\/10/i);
    assertNoRawNeutralHex(header, "PageHeader.tsx");
  });

  it("uses shared compact card styling in list and timeline rows", () => {
    const listRow = readSource("src/components/compact/CompactListRow.tsx");
    expect(listRow).toMatch(/uiBrandingClasses\.card\.inner/);
    expect(listRow).toMatch(/ui-badge/);
    expect(listRow).toMatch(/ui-empty-state__action|ui-btn-ghost/);

    const timeline = readSource("src/components/compact/CompactTimelineItem.tsx");
    expect(timeline).toMatch(/uiBrandingClasses\.kpi\.card/);
    expect(timeline).toMatch(/ui-kpi-card__hint/);
    assertNoRawNeutralHex(listRow, "CompactListRow.tsx");
    assertNoRawNeutralHex(timeline, "CompactTimelineItem.tsx");
  });

  it("completes PerformanceRadar chart shell migration with ChartNoData", () => {
    const radar = readSource("src/components/PerformanceRadar.tsx");
    expect(radar).toMatch(/ChartNoData/);
    expect(radar).toMatch(/uiBrandingClasses\.chart\.shell/);
    expect(radar).toMatch(/ui-empty-state__action/);
    expect(radar).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    expect(radar).toMatch(/uiBrandingClasses\.kpi\.(card|chipBrand)/);
    expect(radar).not.toMatch(/AthleteDetailPrimitives/);
    assertNoRawNeutralHex(radar, "PerformanceRadar.tsx");
    expect(uiBrandingClasses.chart.shell).toBe("ui-chart-shell");
  });

  it("does not reintroduce duplicate QuickStat, MetricBadge, or NoData exports", () => {
    for (const file of WAVE35_PRIMITIVE_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/export function QuickStat/);
      expect(source).not.toMatch(/export function MetricBadge/);
      expect(source).not.toMatch(/export function NoData/);
    }
  });
});
