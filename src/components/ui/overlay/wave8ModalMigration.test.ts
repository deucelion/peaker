import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OVERLAY_Z, overlayZIndex } from "./overlayZIndex";

const REPO_ROOT = join(__dirname, "../../../..");

/** Wave 8 migration targets — see docs/branding/wave-08.md */
export const WAVE8_MODAL_FILES = [
  "src/app/(dashboard)/haftalik-ders-programi/_components/QuickCreateLessonModal.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/LessonDetailModal.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/OverlapListModal.tsx",
  "src/components/privateLessons/PrivateLessonPackageFormModal.tsx",
  "src/components/privateLessons/PrivateLessonPackageEditModal.tsx",
  "src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx",
  "src/components/privateLessons/PackageDetailFaz18Panels.tsx",
  "src/app/(dashboard)/koclar/page.tsx",
  "src/app/(dashboard)/ozel-ders-paketleri/page.tsx",
  "src/app/(dashboard)/ozel-ders-paketleri/[packageId]/page.tsx",
  "src/app/(dashboard)/sistem-operasyonlari/page.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentModal.tsx",
  "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx",
  "src/app/(dashboard)/tahsilat-merkezi/page.tsx",
] as const;

function readWave8Source(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("Wave 8 modal migration", () => {
  it("migrates every scoped file to OverlayDialog", () => {
    for (const file of WAVE8_MODAL_FILES) {
      const source = readWave8Source(file);
      expect(source, `${file} must import OverlayDialog`).toMatch(/OverlayDialog/);
      expect(source, `${file} must not keep inline fixed overlay shells`).not.toMatch(
        /fixed inset-0 z-\[?\d/
      );
    }
  });

  it("uses OVERLAY_Z registry layers instead of raw z-index classes", () => {
    for (const file of WAVE8_MODAL_FILES) {
      const source = readWave8Source(file);
      expect(source, `${file} must reference OVERLAY_Z`).toMatch(/OVERLAY_Z\./);
    }
  });

  it("uses OverlayFooter where modal actions exist", () => {
    const footerTargets = WAVE8_MODAL_FILES.filter(
      (file) =>
        !file.includes("QuickCreateLessonModal") &&
        !file.includes("MuhasebePaymentModal") &&
        !file.includes("tahsilat-merkezi") &&
        !file.includes("koclar/page") &&
        !file.includes("ozel-ders-paketleri/page.tsx")
    );
    for (const file of footerTargets) {
      const source = readWave8Source(file);
      const hasFooter = /OverlayFooter/.test(source) || /CompactModalFooter/.test(source);
      expect(hasFooter, `${file} should use OverlayFooter for actions`).toBe(true);
    }
  });

  it("orders nested payment stack below overlap confirm priority layer", () => {
    expect(overlayZIndex(OVERLAY_Z.MODAL_ELEVATED)).toBeLessThan(overlayZIndex(OVERLAY_Z.TOAST));
    expect(overlayZIndex(OVERLAY_Z.TOAST)).toBeLessThan(overlayZIndex(OVERLAY_Z.DRAWER_PRIORITY));
  });

  it("keeps overlap confirm on DRAWER_PRIORITY above calendar modals", () => {
    const overlap = readWave8Source(
      "src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx"
    );
    expect(overlap).toMatch(/OVERLAY_Z\.DRAWER_PRIORITY/);

    const calendar = readWave8Source(
      "src/app/(dashboard)/haftalik-ders-programi/_components/LessonDetailModal.tsx"
    );
    expect(calendar).toMatch(/OVERLAY_Z\.MODAL_ELEVATED/);
    expect(overlayZIndex(OVERLAY_Z.DRAWER_PRIORITY)).toBeGreaterThan(
      overlayZIndex(OVERLAY_Z.MODAL_ELEVATED)
    );
  });

  it("preserves semantic warning/critical classes on overlap confirm", () => {
    const source = readWave8Source(
      "src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx"
    );
    expect(source).toMatch(/border-red-500\/40 bg-red-500\/10 text-red-100/);
    expect(source).toMatch(/border-amber-500\/35 bg-amber-500\/10 text-amber-100/);
  });

  it("binds escape-to-close via OverlayDialog onClose for interactive modals", () => {
    const overlap = readWave8Source(
      "src/components/privateLessons/PrivateLessonSlotOverlapConfirmModal.tsx"
    );
    expect(overlap).toMatch(/onClose=\{onCancel\}/);

    const payments = readWave8Source(
      "src/app/(dashboard)/muhasebe-finans/_components/MuhasebePaymentsTable.tsx"
    );
    expect(payments).toMatch(/onClose=\{\(\) => \{/);
  });

  it("applies mobile safe-area via shared overlay footer primitive", () => {
    const globals = readFileSync(join(REPO_ROOT, "src/app/(dashboard)/globals.css"), "utf8");
    expect(globals).toMatch(/ui-overlay-footer[\s\S]*safe-area-inset-bottom/);
  });
});
