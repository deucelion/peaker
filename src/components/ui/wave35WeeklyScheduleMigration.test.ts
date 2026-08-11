import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 7 — weekly schedule & calendar migration targets */
export const WAVE35_WEEKLY_SCHEDULE_FILES = [
  "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyScheduleGrid.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyTopBar.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/LessonDetailModal.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/QuickCreateLessonModal.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/OverlapListModal.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/page.tsx",
  "src/app/(dashboard)/takvim/page.tsx",
] as const;

const RAW_SHELL_PATTERNS = [
  "bg-black/20",
  "bg-black/30",
  "border-white/10",
  "from-purple",
  "to-purple",
] as const;

const FORBIDDEN_NEUTRAL_HEX = [
  "121215",
  "7c3aed",
  "c4b5fd",
  "6d28d9",
  "101013",
  "17171d",
  "111114",
  "111117",
  "17171f",
  "0f0f13",
  "0d0d11",
] as const;

const SEMANTIC_SCHEDULE_MARKERS = [
  "border-indigo-",
  "border-emerald-",
  "border-amber-",
  "border-rose-",
  "text-amber-",
  "text-emerald-",
  "text-rose-",
  "locationCardStyle",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawBrandingShells(source: string, file: string) {
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(source.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  for (const hex of FORBIDDEN_NEUTRAL_HEX) {
    expect(source.includes(hex), `${file} must not contain neutral hex ${hex}`).toBe(false);
  }
}

describe("FAZ 35 Wave 7 — weekly schedule & calendar migration", () => {
  it("targets all Wave 7 files in the repository", () => {
    for (const file of WAVE35_WEEKLY_SCHEDULE_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes raw branding shells from all Wave 7 targets", () => {
    for (const file of WAVE35_WEEKLY_SCHEDULE_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses existing ui-card, ui-table, ui-toolbar, and form primitives", () => {
    expect(readSource("src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyScheduleGrid.tsx")).toMatch(
      /ui-table-shell|ui-table-head--filled|ui-card-inner/
    );
    expect(readSource("src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyTopBar.tsx")).toMatch(
      /ui-toolbar|ui-input|ui-select/
    );
    expect(readSource("src/app/(dashboard)/haftalik-ders-programi/_components/QuickCreateLessonModal.tsx")).toMatch(
      /ui-input|ui-select|ui-textarea|ui-btn-/
    );
    expect(readSource("src/app/(dashboard)/haftalik-ders-programi/page.tsx")).toMatch(/ui-page|ui-card/);
    expect(readSource("src/app/(dashboard)/takvim/page.tsx")).toMatch(/ui-card|ui-kpi-band/);
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.layout.toolbar).toBe("ui-toolbar");
  });

  it("tokenizes brand primary through existing CSS variables", () => {
    for (const file of [
      "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyTopBar.tsx",
      "src/app/(dashboard)/haftalik-ders-programi/page.tsx",
      "src/app/(dashboard)/takvim/page.tsx",
    ] as const) {
      expect(readSource(file)).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    }
  });

  it("keeps OverlayDialog architecture on schedule modals", () => {
    for (const file of [
      "src/app/(dashboard)/haftalik-ders-programi/_components/LessonDetailModal.tsx",
      "src/app/(dashboard)/haftalik-ders-programi/_components/QuickCreateLessonModal.tsx",
      "src/app/(dashboard)/haftalik-ders-programi/_components/OverlapListModal.tsx",
    ] as const) {
      const source = readSource(file);
      expect(source).toMatch(/OverlayDialog/);
      expect(source).toMatch(/ui-card/);
    }
  });

  it("preserves semantic lesson status and overlap colors", () => {
    const grid = readSource("src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyScheduleGrid.tsx");
    expect(grid).toMatch(/border-amber-300\/40 bg-amber-500\/20/);

    const detail = readSource("src/app/(dashboard)/haftalik-ders-programi/_components/LessonDetailModal.tsx");
    expect(detail).toMatch(/border-indigo-400\/40 bg-indigo-500\/10/);
    expect(detail).toMatch(/border-emerald-400\/40 bg-emerald-500\/10/);
    expect(detail).toMatch(/border-amber-400\/30 bg-amber-500\/15/);
    expect(detail).toMatch(/border-rose-500\/40 bg-rose-500\/20/);

    const quickCreate = readSource(
      "src/app/(dashboard)/haftalik-ders-programi/_components/QuickCreateLessonModal.tsx"
    );
    expect(quickCreate).toMatch(/border-rose-400\/35 bg-rose-500\/10/);
    expect(quickCreate).toMatch(/border-amber-500\/35 bg-amber-500\/10/);

    const overlap = readSource("src/app/(dashboard)/haftalik-ders-programi/_components/OverlapListModal.tsx");
    expect(overlap).toMatch(/locationCardStyle/);
    expect(overlap).toMatch(/text-emerald-200\/90/);

    const withSemantic = WAVE35_WEEKLY_SCHEDULE_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_SCHEDULE_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(5);
  });

  it("does not reintroduce deprecated primitives or new branding providers", () => {
    for (const file of WAVE35_WEEKLY_SCHEDULE_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/AthleteDetailPrimitives/);
      expect(source).not.toMatch(/EmptyStateCard/);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/createContext\(/);
    }
  });
});
