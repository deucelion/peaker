import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 2 — athlete detail hub migration targets */
export const WAVE35_ATHLETE_HUB_FILES = [
  "src/app/(dashboard)/sporcu/[id]/_components/AthletePerformanceHero.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteCriticalStatusBar.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteHeader.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteProfileForm.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteInjurySection.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteWellnessSection.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteTimelineSection.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthletePrivateLessonPackagesSection.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthleteFieldTestPdfExport.tsx",
  "src/app/(dashboard)/sporcu/[id]/_components/AthletePerformancePdfExport.tsx",
  "src/app/(dashboard)/sporcu/[id]/AthleteFieldTestsPanel.tsx",
  "src/app/(dashboard)/sporcu/[id]/AthletePerformanceInsightsPanel.tsx",
  "src/components/athlete/AthleteBodyMeasurementSection.tsx",
  "src/components/athlete/AthleteCard.tsx",
  "src/components/athlete/AthletePageHeader.tsx",
  "src/app/(dashboard)/finans/[athleteId]/page.tsx",
  "src/app/(dashboard)/sporcu/finans/page.tsx",
  "src/app/(dashboard)/sporcu/sabah-raporu/page.tsx",
  "src/components/admin/AdminSetPasswordPanel.tsx",
  "src/components/admin/SuperAdminPasswordHub.tsx",
] as const;

const RAW_SHELL_PATTERNS = ["bg-black/20", "from-purple", "to-purple"] as const;

const SEMANTIC_PRESERVATION_MARKERS = [
  "text-red-",
  "text-amber-",
  "text-emerald-",
  "text-green-",
  "wellnessToneToTextClass",
  "PACKAGE_LIFECYCLE_TONE",
  "TONE_CLASS",
  "priorityCue",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawBrandingShells(source: string, file: string) {
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(source.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  expect(source.includes("121215"), `${file} must not contain neutral hex`).toBe(false);
  expect(source.includes("7c3aed"), `${file} must not contain brand hex literal`).toBe(false);
}

describe("FAZ 35 Wave 2 — athlete detail hub migration", () => {
  it("removes raw branding shells from all Wave 2 targets", () => {
    for (const file of WAVE35_ATHLETE_HUB_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses ui-card and ui-kpi primitives across athlete hub sections", () => {
    expect(readSource("src/components/athlete/AthleteCard.tsx")).toMatch(/uiBrandingClasses\.card\.base/);
    expect(readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteCriticalStatusBar.tsx")).toMatch(
      /uiBrandingClasses\.(card|kpi)/
    );
    expect(readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteProfileForm.tsx")).toMatch(
      /uiBrandingClasses\.kpi\.chip/
    );
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.kpi.card).toBe("ui-kpi-card");
  });

  it("uses ChartFrame/ChartNoData and ui-chart-shell where charts render", () => {
    const hero = readSource("src/app/(dashboard)/sporcu/[id]/_components/AthletePerformanceHero.tsx");
    expect(hero).toMatch(/ChartFrame/);
    expect(hero).toMatch(/uiBrandingClasses\.card\.chart/);
    expect(hero).toMatch(/var\(--peaker-ui-PRIMARY\)/);

    const body = readSource("src/components/athlete/AthleteBodyMeasurementSection.tsx");
    expect(body).toMatch(/ui-chart-shell/);
    expect(body).toMatch(/chartTooltipStyle/);

    const insights = readSource("src/app/(dashboard)/sporcu/[id]/AthletePerformanceInsightsPanel.tsx");
    expect(insights).toMatch(/ChartFrame/);
  });

  it("uses EmptyState for hub empty views", () => {
    for (const file of [
      "src/app/(dashboard)/sporcu/[id]/_components/AthleteWellnessSection.tsx",
      "src/app/(dashboard)/sporcu/[id]/_components/AthleteTimelineSection.tsx",
      "src/app/(dashboard)/sporcu/[id]/_components/AthleteInjurySection.tsx",
      "src/app/(dashboard)/sporcu/[id]/_components/AthletePrivateLessonPackagesSection.tsx",
    ] as const) {
      expect(readSource(file)).toMatch(/EmptyState/);
    }
  });

  it("does not reference deleted AthleteDetailPrimitives", () => {
    for (const file of WAVE35_ATHLETE_HUB_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/AthleteDetailPrimitives/);
      expect(source).not.toMatch(/export function QuickStat/);
      expect(source).not.toMatch(/export function MetricBadge/);
      expect(source).not.toMatch(/export function NoData/);
    }
    expect(existsSync(join(REPO_ROOT, "src/app/(dashboard)/sporcu/[id]/_components/AthleteDetailPrimitives.tsx"))).toBe(
      false
    );
  });

  it("preserves semantic wellness, injury, and finance color markers", () => {
    const wellness = readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteWellnessSection.tsx");
    expect(wellness).toMatch(/wellnessToneToTextClass/);

    const injury = readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteInjurySection.tsx");
    expect(injury).toMatch(/uiBrandingClasses\.button\.danger|border-red-/);

    const statusBar = readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteCriticalStatusBar.tsx");
    expect(statusBar).toMatch(/TONE_CLASS|priorityCue/);

    const packages = readSource(
      "src/app/(dashboard)/sporcu/[id]/_components/AthletePrivateLessonPackagesSection.tsx"
    );
    expect(packages).toMatch(/PACKAGE_LIFECYCLE_TONE/);

    const finansAthlete = readSource("src/app/(dashboard)/finans/[athleteId]/page.tsx");
    expect(finansAthlete).toMatch(/bg-green-600|text-green-/);

    const sporcuFinans = readSource("src/app/(dashboard)/sporcu/finans/page.tsx");
    expect(sporcuFinans).toMatch(/border-amber-|text-amber-/);
  });

  it("uses ui-input and ui-btn primitives on forms and exports", () => {
    expect(readSource("src/app/(dashboard)/sporcu/[id]/_components/AthleteProfileForm.tsx")).toMatch(
      /uiBrandingClasses\.form\.input/
    );
    expect(readSource("src/app/(dashboard)/sporcu/[id]/_components/AthletePerformancePdfExport.tsx")).toMatch(
      /uiBrandingClasses\.form\.input/
    );
    expect(readSource("src/components/admin/AdminSetPasswordPanel.tsx")).toMatch(/uiBrandingClasses\.form\.input/);
  });
});
