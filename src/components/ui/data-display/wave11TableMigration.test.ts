import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../../..");

/** Wave 11 migration targets — see docs/branding/wave-11.md */
export const WAVE11_TABLE_CONSUMER_FILES = [
  "src/app/(dashboard)/audit-log/page.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeLessonsTable.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeCoachesTable.tsx",
  "src/app/(dashboard)/sistem-operasyonlari/page.tsx",
  "src/app/(dashboard)/sporcu/[id]/AthletePerformanceInsightsPanel.tsx",
  "src/app/(dashboard)/sporcu/[id]/AthleteFieldTestsPanel.tsx",
  "src/components/athlete/AthleteBodyMeasurementSection.tsx",
  "src/app/(dashboard)/oyuncular/_components/TeamsListPanel.tsx",
  "src/app/(dashboard)/oyuncular/_components/TeamDetailPanel.tsx",
  "src/components/performance/PerformanceTeamListView.tsx",
  "src/components/privateLessons/PackageDetailFaz18Panels.tsx",
] as const;

export const WAVE11_TABLE_PRIMITIVE_FILES = [
  "src/components/ui/data-display/DataTable.tsx",
  "src/components/ui/data-display/DataTableToolbar.tsx",
  "src/components/ui/data-display/DataTablePagination.tsx",
  "src/app/(dashboard)/globals.css",
  "src/lib/ui/branding/tableSelectors.ts",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("Wave 11 table migration", () => {
  it("migrates all 13 scoped consumers to DataTable", () => {
    for (const file of WAVE11_TABLE_CONSUMER_FILES) {
      const source = readSource(file);
      expect(source, `${file} must import DataTable`).toMatch(/DataTable/);
      expect(source, `${file} must not keep inline <table> markup`).not.toMatch(/<table\b/);
    }
  });

  it("uses branded ui-table classes in primitives and globals", () => {
    const dataTable = readSource("src/components/ui/data-display/DataTable.tsx");
    expect(dataTable).toMatch(/ui-table-shell/);
    expect(dataTable).toMatch(/ui-table-scroll/);
    expect(dataTable).toMatch(/ui-table-head--filled/);
    expect(dataTable).toMatch(/ui-table-head--sticky/);
    expect(dataTable).toMatch(/ui-table-row--hover/);

    const globals = readSource("src/app/(dashboard)/globals.css");
    expect(globals).toMatch(/\.ui-table-shell/);
    expect(globals).toMatch(/var\(--peaker-ui-SURFACE/);
    expect(globals).toMatch(/var\(--peaker-ui-PRIMARY/);
    expect(globals).toMatch(/\.ui-table-row--hover:hover/);
    expect(globals).toMatch(/\.ui-table-row--selected/);
    expect(globals).toMatch(/\.ui-table-head--sticky/);
  });

  it("binds toolbar and pagination to ui-table-* classes", () => {
    expect(readSource("src/components/ui/data-display/DataTableToolbar.tsx")).toMatch(/ui-table-toolbar/);
    const pagination = readSource("src/components/ui/data-display/DataTablePagination.tsx");
    expect(pagination).toMatch(/ui-table-pagination/);
    expect(pagination).toMatch(/ui-table-pagination__button/);
    expect(pagination).not.toMatch(/PAGINATION_BUTTON_CLASS/);
  });

  it("aligns uiBrandingClasses table references with globals contract", () => {
    expect(uiBrandingClasses.data.tableShell).toBe("ui-table-shell");
    expect(uiBrandingClasses.data.tableScroll).toBe("ui-table-scroll");
    expect(uiBrandingClasses.data.tableToolbar).toBe("ui-table-toolbar");
    expect(uiBrandingClasses.data.tablePagination).toBe("ui-table-pagination");
    expect(uiBrandingClasses.data.tableRowHover).toBe("ui-table-row ui-table-row--hover");
  });

  it("uses records layout for audit-log list grid", () => {
    const audit = readSource("src/app/(dashboard)/audit-log/page.tsx");
    expect(audit).toMatch(/layout="records"/);
    expect(audit).toMatch(/ui-table-row ui-table-row--hover/);
    expect(audit).toMatch(/DataTablePagination/);
  });

  it("preserves keyboard-selectable team rows", () => {
    const teams = readSource("src/app/(dashboard)/oyuncular/_components/TeamsListPanel.tsx");
    expect(teams).toMatch(/role="button"/);
    expect(teams).toMatch(/tabIndex=\{0\}/);
    expect(teams).toMatch(/uiTableRowHoverClass/);
    expect(teams).toMatch(/focus-visible:ring/);
  });

  it("does not introduce raw brand hex in new table selector layer", () => {
    const selectorSource = readSource("src/lib/ui/branding/tableSelectors.ts");
    expect(selectorSource.includes("#")).toBe(false);
    expect(selectorSource).toContain("UI_CONTENT_THEME_VARS");
  });

  it("exports table selector helpers from branding barrel", () => {
    const index = readSource("src/lib/ui/branding/index.ts");
    expect(index).toMatch(/tableSelectors/);
    expect(index).toMatch(/tableShellStyle/);
  });
});
