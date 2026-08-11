import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 8 — training & lessons migration targets */
export const WAVE35_TRAINING_LESSONS_FILES = [
  "src/app/(dashboard)/antrenman-yonetimi/page.tsx",
  "src/app/(dashboard)/dersler/page.tsx",
  "src/app/(dashboard)/dersler/[lessonId]/page.tsx",
  "src/app/(dashboard)/programlarim/page.tsx",
  "src/app/(dashboard)/antrenman-yonetimi/_components/GroupLessonsView.tsx",
  "src/app/(dashboard)/antrenman-yonetimi/_components/PrivateLessonsView.tsx",
] as const;

/** Wave 8 allowlist removals — Group/Private views were cleared in Wave 5. */
export const WAVE35_TRAINING_LESSONS_ALLOWLIST_REMOVALS = [
  "src/app/(dashboard)/antrenman-yonetimi/page.tsx",
  "src/app/(dashboard)/dersler/page.tsx",
  "src/app/(dashboard)/dersler/[lessonId]/page.tsx",
  "src/app/(dashboard)/programlarim/page.tsx",
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
  "1c1c21",
  "0c0c0f",
  "b8a4f8",
  "d8cbff",
] as const;

const SEMANTIC_LESSON_MARKERS = [
  "border-emerald-",
  "border-indigo-",
  "border-amber-",
  "border-rose-",
  "border-red-",
  "text-emerald-",
  "text-amber-",
  "text-rose-",
  "lessonStatusBadgeClass",
  "PACKAGE_LIFECYCLE",
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

describe("FAZ 35 Wave 8 — training & lessons migration", () => {
  it("targets all Wave 8 files in the repository", () => {
    for (const file of WAVE35_TRAINING_LESSONS_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes raw branding shells from all Wave 8 targets", () => {
    for (const file of WAVE35_TRAINING_LESSONS_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses existing ui-page, ui-card, ui-toolbar, and form primitives", () => {
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/page.tsx")).toMatch(/ui-page|UiTabsNav/);
    expect(readSource("src/app/(dashboard)/dersler/page.tsx")).toMatch(/ui-page|ui-h1|ui-lead/);
    expect(readSource("src/app/(dashboard)/dersler/[lessonId]/page.tsx")).toMatch(/ui-input|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/programlarim/page.tsx")).toMatch(/ui-page|ui-card/);
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/_components/GroupLessonsView.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/_components/PrivateLessonsView.tsx")).toMatch(/ui-card/);
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.form.input).toBe("ui-input");
  });

  it("tokenizes brand primary through existing CSS variables", () => {
    for (const file of WAVE35_TRAINING_LESSONS_ALLOWLIST_REMOVALS) {
      expect(readSource(file)).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    }
  });

  it("uses EmptyState and removes EmptyStateCard from migrated targets", () => {
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/page.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/_components/GroupLessonsView.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/_components/PrivateLessonsView.tsx")).toMatch(/EmptyState/);

    for (const file of WAVE35_TRAINING_LESSONS_FILES) {
      expect(readSource(file)).not.toMatch(/EmptyStateCard/);
    }
  });

  it("preserves overlay infrastructure and semantic lesson colors", () => {
    expect(readSource("src/app/(dashboard)/antrenman-yonetimi/page.tsx")).toMatch(/OverlayMenu/);

    const dersler = readSource("src/app/(dashboard)/dersler/page.tsx");
    expect(dersler).toMatch(/lessonStatusBadgeClass/);
    expect(dersler).toMatch(/border-amber-500\/35 bg-amber-500\/10/);

    const group = readSource("src/app/(dashboard)/antrenman-yonetimi/_components/GroupLessonsView.tsx");
    expect(group).toMatch(/border-amber-500\/40 bg-amber-500\/10/);
    expect(group).toMatch(/border-rose-500/);

    const privateView = readSource("src/app/(dashboard)/antrenman-yonetimi/_components/PrivateLessonsView.tsx");
    expect(privateView).toMatch(/border-emerald-/);

    const withSemantic = WAVE35_TRAINING_LESSONS_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_LESSON_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(4);
  });

  it("does not introduce deprecated primitives or new branding providers", () => {
    for (const file of WAVE35_TRAINING_LESSONS_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/AthleteDetailPrimitives/);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/createContext\(/);
    }
  });
});
