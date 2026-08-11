import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 9 — field tests migration targets (from postWaveSurfaceBacklog). */
export const WAVE35_FIELD_TESTS_FILES = [
  "src/app/(dashboard)/saha-testleri/_components/FieldTestAthletePicker.tsx",
  "src/app/(dashboard)/saha-testleri/_components/FieldTestMetricsEditor.tsx",
  "src/app/(dashboard)/saha-testleri/_components/FieldTestSessionEntry.tsx",
  "src/app/(dashboard)/saha-testleri/_components/FieldTestSessionHub.tsx",
  "src/app/(dashboard)/saha-testleri/_components/FieldTestSingleAthleteEntry.tsx",
] as const;

export const WAVE35_FIELD_TESTS_ALLOWLIST_REMOVALS = [...WAVE35_FIELD_TESTS_FILES] as const;

const RAW_SHELL_PATTERNS = [
  "bg-black/20",
  "bg-black/30",
  "border-white/10",
  "border-white/15",
  "bg-white/5",
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
  "1c1c21",
  "0c0c0f",
  "b8a4f8",
  "d8cbff",
] as const;

const SEMANTIC_FIELD_TEST_MARKERS = [
  "border-emerald-",
  "border-amber-",
  "border-rose-",
  "text-emerald-",
  "text-amber-",
  "text-rose-",
  "bg-red-500/",
  "text-red-",
  "improvement_direction",
  "higher_better",
  "lower_better",
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
  expect(source.includes("ui-btn-primary/"), `${file} must not contain invalid ui-btn-primary opacity classes`).toBe(
    false
  );
}

describe("FAZ 35 Wave 9 — field tests migration", () => {
  it("targets all Wave 9 files in the repository", () => {
    for (const file of WAVE35_FIELD_TESTS_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes raw branding shells from all Wave 9 targets", () => {
    for (const file of WAVE35_FIELD_TESTS_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses existing ui-card, ui-kpi, form, and button primitives", () => {
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestAthletePicker.tsx")).toMatch(/ui-card|ui-input/);
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestMetricsEditor.tsx")).toMatch(/ui-page|ui-card|ui-select|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestSessionEntry.tsx")).toMatch(/ui-page|ui-kpi-card|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestSessionHub.tsx")).toMatch(/ui-page|ui-kpi-chip--brand|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestSingleAthleteEntry.tsx")).toMatch(/ui-card|ui-input|ui-textarea/);
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.form.input).toBe("ui-input");
    expect(uiBrandingClasses.kpi.chipBrand).toBe("ui-kpi-chip--brand");
  });

  it("tokenizes brand primary through existing CSS variables", () => {
    for (const file of WAVE35_FIELD_TESTS_ALLOWLIST_REMOVALS) {
      expect(readSource(file)).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    }
  });

  it("uses EmptyState and removes EmptyStateCard from migrated targets", () => {
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestMetricsEditor.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestSessionEntry.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestSessionHub.tsx")).toMatch(/EmptyState/);

    for (const file of WAVE35_FIELD_TESTS_FILES) {
      expect(readSource(file)).not.toMatch(/EmptyStateCard/);
    }
  });

  it("preserves field-test semantic status and validation colors", () => {
    const sessionEntry = readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestSessionEntry.tsx");
    expect(sessionEntry).toMatch(/border-emerald-500\/30 bg-emerald-500\/10/);
    expect(sessionEntry).toMatch(/border-amber-500\/30 bg-amber-500\/10/);
    expect(sessionEntry).toMatch(/border-rose-500\/30 bg-rose-500\/10/);
    expect(sessionEntry).toMatch(/hover:border-emerald-500\/40/);

    const athletePicker = readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestAthletePicker.tsx");
    expect(athletePicker).toMatch(/bg-emerald-500\/15/);
    expect(athletePicker).toMatch(/text-emerald-300/);

    const metricsEditor = readSource("src/app/(dashboard)/saha-testleri/_components/FieldTestMetricsEditor.tsx");
    expect(metricsEditor).toMatch(/bg-red-500\/10 text-red-400/);
    expect(metricsEditor).toMatch(/higher_better/);
    expect(metricsEditor).toMatch(/lower_better/);

    const withSemantic = WAVE35_FIELD_TESTS_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_FIELD_TEST_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(3);
  });

  it("does not introduce deprecated primitives or new branding providers", () => {
    for (const file of WAVE35_FIELD_TESTS_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/AthleteDetailPrimitives/);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/createContext\(/);
    }
  });
});
