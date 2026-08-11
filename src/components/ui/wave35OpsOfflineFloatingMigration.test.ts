import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 10 — ops / drawer / offline / floating UI migration targets */
export const WAVE35_OPS_OFFLINE_FLOATING_FILES = [
  "src/components/offline/SyncStatusBadge.tsx",
  "src/components/offline/SyncStatusCenter.tsx",
  "src/components/ops/ProductionHealthOverview.tsx",
  "src/components/mobile/AthleteMobileQuickStrip.tsx",
  "src/components/mobile/CoachMobileQuickStrip.tsx",
  "src/app/(dashboard)/sistem-operasyonlari/page.tsx",
] as const;

export const WAVE35_OPS_OFFLINE_FLOATING_ALLOWLIST_REMOVALS = [...WAVE35_OPS_OFFLINE_FLOATING_FILES] as const;

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

const SEMANTIC_OPS_MARKERS = [
  "border-emerald-",
  "border-amber-",
  "border-rose-",
  "border-red-",
  "border-orange-",
  "text-emerald-",
  "text-amber-",
  "text-rose-",
  "text-red-",
  "bg-red-500",
  "border-sky-",
  "text-sky-",
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

describe("FAZ 35 Wave 10 — ops / offline / floating UI migration", () => {
  it("targets all Wave 10 files in the repository", () => {
    for (const file of WAVE35_OPS_OFFLINE_FLOATING_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes raw branding shells from all Wave 10 targets", () => {
    for (const file of WAVE35_OPS_OFFLINE_FLOATING_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses existing overlay, card, kpi, and button primitives", () => {
    expect(readSource("src/components/offline/SyncStatusCenter.tsx")).toMatch(/OverlaySheet/);
    expect(readSource("src/components/offline/SyncStatusCenter.tsx")).toMatch(/OverlayFooter/);
    expect(readSource("src/components/offline/SyncStatusBadge.tsx")).toMatch(/ui-kpi-band/);
    expect(readSource("src/components/ops/ProductionHealthOverview.tsx")).toMatch(/ui-kpi-chip--brand/);
    expect(readSource("src/components/mobile/AthleteMobileQuickStrip.tsx")).toMatch(/ui-card/);
    expect(readSource("src/components/mobile/CoachMobileQuickStrip.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/sistem-operasyonlari/page.tsx")).toMatch(/OverlayDialog/);
    expect(readSource("src/app/(dashboard)/sistem-operasyonlari/page.tsx")).toMatch(/ui-page|ui-card/);
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.button.primary).toBe("ui-btn-primary");
  });

  it("tokenizes brand primary through existing CSS variables", () => {
    const primaryVarFiles = WAVE35_OPS_OFFLINE_FLOATING_ALLOWLIST_REMOVALS.filter(
      (file) => file !== "src/components/ops/ProductionHealthOverview.tsx"
    );
    for (const file of primaryVarFiles) {
      expect(readSource(file)).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    }
    expect(readSource("src/components/ops/ProductionHealthOverview.tsx")).toMatch(/ui-kpi-chip--brand/);
  });

  it("preserves operational and offline semantic status colors", () => {
    const syncCenter = readSource("src/components/offline/SyncStatusCenter.tsx");
    expect(syncCenter).toMatch(/border-rose-500\/30 bg-rose-500\/10/);
    expect(syncCenter).toMatch(/border-amber-500\/30 bg-amber-500\/10/);
    expect(syncCenter).toMatch(/border-orange-500\/30 bg-orange-500\/10/);
    expect(syncCenter).toMatch(/text-emerald-400/);

    const syncBadge = readSource("src/components/offline/SyncStatusBadge.tsx");
    expect(syncBadge).toMatch(/text-emerald-400/);
    expect(syncBadge).toMatch(/text-amber-400/);

    const coachStrip = readSource("src/components/mobile/CoachMobileQuickStrip.tsx");
    expect(coachStrip).toMatch(/border-amber-500\/25 bg-amber-500\/10/);
    expect(coachStrip).toMatch(/bg-red-500/);

    const opsPage = readSource("src/app/(dashboard)/sistem-operasyonlari/page.tsx");
    expect(opsPage).toMatch(/text-emerald-400 border-emerald-500\/30/);
    expect(opsPage).toMatch(/alertSeverityClass/);

    const withSemantic = WAVE35_OPS_OFFLINE_FLOATING_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_OPS_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(5);
  });

  it("does not introduce deprecated primitives or new branding providers", () => {
    for (const file of WAVE35_OPS_OFFLINE_FLOATING_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/EmptyStateCard/);
      expect(source).not.toMatch(/PendingActionsDrawer/);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/createContext\(/);
    }
  });
});
