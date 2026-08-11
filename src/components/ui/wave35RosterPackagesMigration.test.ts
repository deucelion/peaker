import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 5 — roster, coaches, teams & packages migration targets */
export const WAVE35_ROSTER_PACKAGES_FILES = [
  "src/app/(dashboard)/oyuncular/page.tsx",
  "src/app/(dashboard)/oyuncular/_components/AthleteCard.tsx",
  "src/app/(dashboard)/oyuncular/_components/TeamDetailPanel.tsx",
  "src/app/(dashboard)/oyuncular/_components/TeamsListPanel.tsx",
  "src/app/(dashboard)/koclar/[coachId]/page.tsx",
  "src/app/(dashboard)/koclar/CoachAccountLifecyclePanel.tsx",
  "src/app/(dashboard)/takimlar/page.tsx",
  "src/app/(dashboard)/takimlar/[teamId]/page.tsx",
  "src/app/(dashboard)/ozel-ders-paketleri/page.tsx",
  "src/app/(dashboard)/ozel-ders-paketleri/[packageId]/page.tsx",
  "src/app/(dashboard)/ozel-ders-paketleri/_components/PackageCard.tsx",
  "src/app/(dashboard)/ozel-ders-paketlerim/page.tsx",
  "src/components/privateLessons/PackageDetailFaz18Panels.tsx",
  "src/components/privateLessons/PrivateLessonPackageEditModal.tsx",
  "src/components/privateLessons/PrivateLessonPackageFormModal.tsx",
  "src/components/privateLessons/PrivateLessonParallelMetricsStrip.tsx",
  "src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx",
  "src/app/(dashboard)/antrenman-yonetimi/_components/GroupLessonsView.tsx",
  "src/app/(dashboard)/antrenman-yonetimi/_components/PrivateLessonsView.tsx",
] as const;

const RAW_SHELL_PATTERNS = ["bg-black/20", "bg-black/30", "from-purple", "to-purple"] as const;

const SEMANTIC_MARKERS = [
  "PACKAGE_LIFECYCLE_TONE",
  "PACKAGE_LIFECYCLE_LABEL",
  "ui-badge-success",
  "ui-badge-danger",
  "border-emerald-",
  "border-amber-",
  "border-rose-",
  "text-emerald-",
  "text-amber-",
  "text-green-",
  "text-rose-",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawBrandingShells(source: string, file: string) {
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(source.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  for (const hex of ["121215", "7c3aed", "c4b5fd", "6d28d9", "0d0d11", "16161c", "17171d"] as const) {
    expect(source.includes(hex), `${file} must not contain neutral hex ${hex}`).toBe(false);
  }
}

describe("FAZ 35 Wave 5 — roster & packages migration", () => {
  it("removes raw branding shells from all Wave 5 targets", () => {
    for (const file of WAVE35_ROSTER_PACKAGES_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses ui-card across roster and package surfaces", () => {
    expect(readSource("src/app/(dashboard)/oyuncular/_components/AthleteCard.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/takimlar/page.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/ozel-ders-paketleri/_components/PackageCard.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/koclar/[coachId]/page.tsx")).toMatch(/ui-card/);
    expect(uiBrandingClasses.card.base).toBe("ui-card");
  });

  it("adopts EmptyState and removes EmptyStateCard", () => {
    for (const file of [
      "src/app/(dashboard)/oyuncular/page.tsx",
      "src/app/(dashboard)/antrenman-yonetimi/_components/GroupLessonsView.tsx",
      "src/app/(dashboard)/antrenman-yonetimi/_components/PrivateLessonsView.tsx",
      "src/app/(dashboard)/ozel-ders-paketleri/page.tsx",
    ] as const) {
      const source = readSource(file);
      expect(source).toMatch(/EmptyState/);
      expect(source).not.toMatch(/EmptyStateCard/);
    }
  });

  it("uses ui-btn and ui-input on forms and actions", () => {
    expect(readSource("src/app/(dashboard)/oyuncular/page.tsx")).toMatch(/ui-btn-primary|ui-btn-ghost/);
    expect(readSource("src/app/(dashboard)/oyuncular/_components/TeamsListPanel.tsx")).toMatch(/ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/ozel-ders-paketleri/page.tsx")).toMatch(/ui-input|FORM_INPUT/);
    expect(readSource("src/app/(dashboard)/koclar/[coachId]/page.tsx")).toMatch(/ui-input|ui-btn-primary/);
    expect(readSource("src/components/privateLessons/PrivateLessonPackageFormModal.tsx")).toMatch(/ui-input|ui-btn-primary/);
  });

  it("preserves package lifecycle and lesson semantic colors", () => {
    expect(readSource("src/app/(dashboard)/ozel-ders-paketleri/[packageId]/page.tsx")).toMatch(/PACKAGE_LIFECYCLE_TONE/);
    expect(readSource("src/app/(dashboard)/koclar/[coachId]/page.tsx")).toMatch(/ui-kpi-chip--brand|text-gray-400/);
    expect(readSource("src/app/(dashboard)/takimlar/[teamId]/page.tsx")).toMatch(/border-emerald-|border-amber-/);

    const withSemantic = WAVE35_ROSTER_PACKAGES_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(6);
  });

  it("tokenizes overlay modal shells without changing overlay components", () => {
    expect(readSource("src/components/privateLessons/PrivateLessonPackageFormModal.tsx")).toMatch(/OverlayDialog/);
    expect(readSource("src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx")).toMatch(/OverlayDialog/);
    expect(readSource("src/app/(dashboard)/ozel-ders-paketleri/page.tsx")).toMatch(/OverlayDialog/);
    expect(readSource("src/components/privateLessons/PrivateLessonPackageFormModal.tsx")).not.toMatch(/121215|16161c/);
  });
});
