import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 3 — finance workspace migration targets */
export const WAVE35_FINANCE_WORKSPACE_FILES = [
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeFinansPanel.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeFilterBar.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeLessonsTable.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentModal.tsx",
  "src/components/finance/FinansYonetimi.tsx",
  "src/components/finance/FinanceFilterDrawer.tsx",
  "src/components/finance/TahsilatRecordSheet.tsx",
  "src/components/finance/MuhasebeOverviewSection.tsx",
  "src/components/finance/AthleteFinanceTimeline.tsx",
  "src/components/finance/ReceivableAgingBuckets.tsx",
  "src/app/(dashboard)/tahsilat-merkezi/page.tsx",
] as const;

const RAW_SHELL_PATTERNS = ["bg-black/20", "bg-black/30", "from-purple", "to-purple"] as const;

const FINANCE_SEMANTIC_MARKERS = [
  "text-emerald-",
  "text-amber-",
  "text-rose-",
  "text-green-",
  "border-emerald-",
  "border-amber-",
  "border-rose-",
  "bg-emerald-",
  "bg-amber-",
  "bg-rose-",
  "bg-green-",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawBrandingShells(source: string, file: string) {
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(source.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  for (const hex of ["121215", "7c3aed", "c4b5fd", "101013", "16161c"] as const) {
    expect(source.includes(hex), `${file} must not contain neutral hex ${hex}`).toBe(false);
  }
}

describe("FAZ 35 Wave 3 — finance workspace migration", () => {
  it("removes raw branding shells from all Wave 3 targets", () => {
    for (const file of WAVE35_FINANCE_WORKSPACE_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses ui-card and ui-kpi primitives across finance workspace", () => {
    expect(readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebeFinansPanel.tsx")).toMatch(
      /ui-kpi-section|uiBrandingClasses\.(card|kpi)/
    );
    expect(readSource("src/components/finance/AthleteFinanceTimeline.tsx")).toMatch(/ui-card|uiBrandingClasses\.card/);
    expect(readSource("src/components/finance/ReceivableAgingBuckets.tsx")).toMatch(/ui-kpi-section/);
    expect(readSource("src/app/(dashboard)/tahsilat-merkezi/page.tsx")).toMatch(/ui-kpi-section|ui-kpi-band/);
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.kpi.section).toBe("ui-kpi-section");
  });

  it("uses DataTable and ui-table infrastructure where tables render", () => {
    for (const file of [
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeLessonsTable.tsx",
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx",
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx",
    ] as const) {
      const source = readSource(file);
      expect(source).toMatch(/DataTable/);
      expect(source).toMatch(/uiTable(Td|Th|Row)/);
    }
  });

  it("uses ui-input and ui-select on finance forms and filters", () => {
    expect(readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebeFilterBar.tsx")).toMatch(/ui-select/);
    expect(readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx")).toMatch(
      /ui-input/
    );
    expect(readSource("src/components/finance/FinansYonetimi.tsx")).toMatch(/ui-input/);
  });

  it("keeps OverlayDrawer, OverlaySheet, and OverlayFooter unchanged", () => {
    expect(readSource("src/components/finance/FinanceFilterDrawer.tsx")).toMatch(/OverlayDrawer/);
    expect(readSource("src/components/finance/FinanceFilterDrawer.tsx")).toMatch(/OverlayFooter/);
    expect(readSource("src/components/finance/TahsilatRecordSheet.tsx")).toMatch(/OverlaySheet/);
    expect(readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentModal.tsx")).toMatch(
      /OverlayDialog|OverlayShell/
    );
  });

  it("uses EmptyState where applicable", () => {
    for (const file of [
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeFinansPanel.tsx",
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeLessonsTable.tsx",
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx",
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx",
    ] as const) {
      expect(readSource(file)).toMatch(/EmptyState/);
    }
  });

  it("preserves finance semantic color markers", () => {
    const filesWithSemantic = WAVE35_FINANCE_WORKSPACE_FILES.filter((file) => {
      const source = readSource(file);
      return FINANCE_SEMANTIC_MARKERS.some((marker) => source.includes(marker));
    });
    expect(filesWithSemantic.length).toBeGreaterThanOrEqual(8);

    const aging = readSource("src/components/finance/ReceivableAgingBuckets.tsx");
    expect(aging).toMatch(/border-rose-|text-rose-/);

    const timeline = readSource("src/components/finance/AthleteFinanceTimeline.tsx");
    expect(timeline).toMatch(/border-amber-|bg-green-600|var\(--peaker-ui-PRIMARY\)/);

    const receivables = readSource("src/app/(dashboard)/muhasebe-finans/_components/MuhasebeReceivablesSection.tsx");
    expect(receivables).toMatch(/text-amber-|text-rose-|border-emerald-/);
  });
});
