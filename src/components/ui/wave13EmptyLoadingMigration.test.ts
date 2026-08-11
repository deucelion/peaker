import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { emptyLoadingSelectors } from "@/lib/ui/branding/emptyLoadingSelectors";

const REPO_ROOT = join(__dirname, "../../..");

/** Wave 13 migration targets — see docs/branding/wave-13.md */
export const WAVE13_EMPTY_LOADING_FILES = [
  "src/components/ui/EmptyState.tsx",
  "src/components/ui/skeletons/Skeleton.tsx",
  "src/components/ui/data-display/LoadingState.tsx",
  "src/components/ui/loading/QueryLoadingShell.tsx",
  "src/components/compact/CompactMetricCard.tsx",
  "src/components/performance/PerformanceOrgSummaryBand.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeKpiGrid.tsx",
  "src/components/athlete/AthleteMetricCard.tsx",
  "src/app/(dashboard)/page.tsx",
  "src/components/EmptyStateCard.tsx",
  "src/components/athlete/AthleteEmptyState.tsx",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("Wave 13 empty / loading / KPI migration", () => {
  it("registers empty, loading, skeleton, and kpi ui-* classes", () => {
    const css = readSource("src/app/(dashboard)/globals.css");
    expect(css).toMatch(/\.ui-empty-state/);
    expect(css).toMatch(/\.ui-loading-panel/);
    expect(css).toMatch(/\.ui-skeleton-pulse/);
    expect(css).toMatch(/\.ui-kpi-card/);
    expect(uiBrandingClasses.empty.state).toBe("ui-empty-state");
    expect(uiBrandingClasses.loading.panel).toBe("ui-loading-panel");
    expect(uiBrandingClasses.skeleton.line).toBe("ui-skeleton-line");
    expect(uiBrandingClasses.kpi.card).toBe("ui-kpi-card");
  });

  it("tokenizes neutral EmptyState shells via ui-empty-state", () => {
    const empty = readSource("src/components/ui/EmptyState.tsx");
    expect(empty).toMatch(/ui-empty-state/);
    expect(empty).toMatch(/ui-empty-state__description/);
    expect(empty.includes("bg-black/20")).toBe(false);
    expect(empty).toMatch(/border-amber-500\/30/);
    expect(empty).toMatch(/border-red-500\/30/);
    expect(empty).toMatch(/border-emerald-500\/25/);
  });

  it("deprecates EmptyStateCard as EmptyState redirect", () => {
    const card = readSource("src/components/EmptyStateCard.tsx");
    expect(card).toMatch(/@deprecated/);
    expect(card).toMatch(/EmptyState/);
    expect(card).toMatch(/variant="no_data"/);
    expect(card.includes("bg-black/20")).toBe(false);
  });

  it("uses token-bound skeleton shells and pulse", () => {
    const skeleton = readSource("src/components/ui/skeletons/Skeleton.tsx");
    expect(skeleton).toMatch(/ui-skeleton-shell/);
    expect(skeleton).toMatch(/ui-skeleton-stat/);
    expect(skeleton).toMatch(/ui-skeleton-line/);
    expect(skeleton).toMatch(/ui-skeleton-pulse/);
    expect(skeleton.includes("121215")).toBe(false);
    expect(skeleton.includes("bg-white/[0.04]")).toBe(false);
  });

  it("uses token-bound loading panels and refresh indicator", () => {
    const loading = readSource("src/components/ui/data-display/LoadingState.tsx");
    expect(loading).toMatch(/ui-loading-panel/);
    expect(loading).toMatch(/ui-loading-inline/);
    expect(loading.includes("7c3aed")).toBe(false);
    expect(loading.includes("121215")).toBe(false);

    const query = readSource("src/components/ui/loading/QueryLoadingShell.tsx");
    expect(query).toMatch(/ui-loading-panel/);
    expect(query).toMatch(/ui-loading-refresh/);
    expect(query.includes("7c3aed")).toBe(false);
  });

  it("uses ui-kpi-card pattern on KPI surfaces", () => {
    expect(readSource("src/components/compact/CompactMetricCard.tsx")).toMatch(/ui-kpi-card/);
    expect(readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebeKpiGrid.tsx")).toMatch(/ui-kpi-section/);
    expect(readSource("src/components/performance/PerformanceOrgSummaryBand.tsx")).toMatch(/ui-kpi-band/);
    expect(readSource("src/components/performance/PerformanceOrgSummaryBand.tsx")).toMatch(/ui-kpi-chip/);
    expect(readSource("src/app/(dashboard)/page.tsx")).toMatch(/ui-kpi-card__trend/);
  });

  it("tokenizes AthleteMetricCard edit ring via ui-metric-card", () => {
    const metric = readSource("src/components/athlete/AthleteMetricCard.tsx");
    expect(metric).toMatch(/ui-metric-card/);
    expect(metric).toMatch(/ui-metric-card__input/);
    expect(metric.includes("7c3aed")).toBe(false);
  });

  it("tokenizes AthleteEmptyState neutral shell", () => {
    const athleteEmpty = readSource("src/components/athlete/AthleteEmptyState.tsx");
    expect(athleteEmpty).toMatch(/ui-empty-state/);
    expect(athleteEmpty).toMatch(/ui-empty-state__action/);
    expect(athleteEmpty.includes("121215")).toBe(false);
    expect(athleteEmpty.includes("7c3aed")).toBe(false);
  });

  it("preserves semantic KPI tones in finance and performance bands", () => {
    const finance = readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebeKpiGrid.tsx");
    expect(finance).toMatch(/text-emerald-/);
    expect(finance).toMatch(/text-amber-/);
    expect(finance).toMatch(/text-red-/);

    const band = readSource("src/components/performance/PerformanceOrgSummaryBand.tsx");
    expect(band).toMatch(/border-amber-500/);
    expect(band).toMatch(/border-red-500/);
    expect(band.includes("7c3aed")).toBe(false);
  });

  it("exports emptyLoadingSelectors contract aligned with UI content vars", () => {
    expect(emptyLoadingSelectors.primary).toContain("var(--peaker-ui-");
    expect(emptyLoadingSelectors.surface).toContain("var(--peaker-ui-");
  });

  it("default branding primary resolves for custom org parity smoke", () => {
    const primary = createDefaultBranding().theme.primary.toLowerCase();
    expect(primary.length).toBeGreaterThan(0);
    expect(WAVE13_EMPTY_LOADING_FILES.length).toBeGreaterThanOrEqual(10);
  });
});
