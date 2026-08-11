import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OVERLAY_Z, overlayZIndex } from "./overlayZIndex";

const REPO_ROOT = join(__dirname, "../../../..");

export const WAVE10_FILES = [
  "src/components/finance/FinanceExportMenu.tsx",
  "src/app/(dashboard)/antrenman-yonetimi/page.tsx",
  "src/components/ui/charts/ChartFrame.tsx",
  "src/lib/ui/branding/chartSelectors.ts",
  "src/components/offline/OfflineActionToast.tsx",
  "src/components/Notification.tsx",
  "src/components/performance/PerformanceTabsNav.tsx",
  "src/components/performance/AthleteDetailSectionNav.tsx",
  "src/app/(dashboard)/saha-testleri/_components/FieldTestSessionSubNav.tsx",
  "src/components/ui/layout/PageHeader.tsx",
  "src/components/performance/PerformanceBreadcrumb.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyTopBar.tsx",
  "src/components/ui/navigation/UiTabsNav.tsx",
  "src/components/ui/navigation/UiBreadcrumb.tsx",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("Wave 10 floating UI migration", () => {
  it("migrates menu surfaces to OverlayMenu", () => {
    expect(readSource("src/components/finance/FinanceExportMenu.tsx")).toMatch(/OverlayMenu/);
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/page.tsx")).toMatch(/OverlayMenu/);
  });

  it("uses OVERLAY_Z registry for floating layers", () => {
    expect(readSource("src/components/finance/FinanceExportMenu.tsx")).toMatch(/OVERLAY_Z\.BACKDROP/);
    expect(readSource("src/components/offline/OfflineActionToast.tsx")).toMatch(/OVERLAY_Z\.TOAST/);
    expect(overlayZIndex(OVERLAY_Z.TOAST)).toBe(125);
  });

  it("removes inline floating menu z-index utilities", () => {
    for (const file of [
      "src/components/finance/FinanceExportMenu.tsx",
      "src/app/(dashboard)/antrenman-yonetimi/page.tsx",
    ] as const) {
      expect(readSource(file)).not.toMatch(/\bz-\[?\d+/);
    }
  });

  it("unifies tab navigation through UiTabsNav", () => {
    for (const file of [
      "src/components/performance/PerformanceTabsNav.tsx",
      "src/components/performance/AthleteDetailSectionNav.tsx",
      "src/app/(dashboard)/saha-testleri/_components/FieldTestSessionSubNav.tsx",
      "src/components/ui/layout/PageHeader.tsx",
      "src/app/(dashboard)/antrenman-yonetimi/page.tsx",
    ] as const) {
      expect(readSource(file)).toMatch(/UiTabsNav/);
    }
  });

  it("uses UiBreadcrumb for performance breadcrumb", () => {
    expect(readSource("src/components/performance/PerformanceBreadcrumb.tsx")).toMatch(/UiBreadcrumb/);
  });

  it("preserves semantic toast interior colors", () => {
    const toast = readSource("src/components/offline/OfflineActionToast.tsx");
    expect(toast).toMatch(/border-emerald-500\/30 bg-emerald-500\/15 text-emerald-100/);
    expect(toast).toMatch(/border-amber-500\/30 bg-amber-500\/15 text-amber-100/);
    expect(toast).toMatch(/ui-toast-shell/);
  });

  it("preserves Notification success/error semantics and info shell class", () => {
    const notification = readSource("src/components/Notification.tsx");
    expect(notification).toMatch(/bg-green-500\/10 border-green-500\/20 text-green-300/);
    expect(notification).toMatch(/bg-red-500\/10 border-red-500\/20 text-red-300/);
    expect(notification).toMatch(/ui-notification-info/);
  });

  it("moves chart tooltip styling to chartSelectors", () => {
    const chartFrame = readSource("src/components/ui/charts/ChartFrame.tsx");
    expect(chartFrame).toMatch(/chartSelectors/);
    expect(chartFrame.includes("#")).toBe(false);

    const selectors = readSource("src/lib/ui/branding/chartSelectors.ts");
    expect(selectors).toMatch(/UI_CONTENT_THEME_VARS/);
    expect(selectors.includes("#")).toBe(false);
  });

  it("uses ui-toolbar on WeeklyTopBar filter band", () => {
    expect(readSource("src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyTopBar.tsx")).toMatch(
      /ui-toolbar/
    );
  });

  it("declares ui tabs/breadcrumb classes in globals", () => {
    const globals = readSource("src/app/(dashboard)/globals.css");
    expect(globals).toMatch(/\.ui-tabs-nav/);
    expect(globals).toMatch(/\.ui-breadcrumb/);
    expect(globals).toMatch(/\.ui-notification-info/);
  });

  it("supports escape close on export menu", () => {
    expect(readSource("src/components/finance/FinanceExportMenu.tsx")).toMatch(/Escape/);
  });
});

describe("Wave 10 UiTabsNav accessibility", () => {
  it("sets aria-current on link tabs and aria-pressed on button tabs", () => {
    const source = readSource("src/components/ui/navigation/UiTabsNav.tsx");
    expect(source).toMatch(/aria-current=\{active \? "page" : undefined\}/);
    expect(source).toMatch(/aria-pressed=\{active\}/);
  });
});
