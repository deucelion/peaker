import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

export const WAVE35_SYSTEM_HEALTH_PWA_FILES = [
  "src/app/(dashboard)/sistem-saglik/page.tsx",
  "src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx",
  "src/app/manifest.ts",
  "src/app/offline/page.tsx",
  "src/components/pwa/PwaInstallBanner.tsx",
] as const;

export const WAVE35_SYSTEM_HEALTH_PWA_UI_FILES = [
  "src/app/(dashboard)/sistem-saglik/page.tsx",
  "src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx",
  "src/app/offline/page.tsx",
  "src/components/pwa/PwaInstallBanner.tsx",
] as const;

export const WAVE35_SYSTEM_HEALTH_PWA_ALLOWLIST_REMOVALS = [...WAVE35_SYSTEM_HEALTH_PWA_FILES] as const;

const RAW_SHELL_PATTERNS = [
  "bg-black/20",
  "bg-black/30",
  "bg-black/40",
  "bg-white/5",
  "border-white/10",
  "border-white/15",
] as const;

const FORBIDDEN_BRANDING_HEX = [
  "121215",
  "7c3aed",
  "c4b5fd",
  "6d28d9",
  "09090b",
  "17171d",
  "e9d5ff",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawBrandingShells(source: string, file: string) {
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(source.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  for (const hex of FORBIDDEN_BRANDING_HEX) {
    expect(source.includes(hex), `${file} must not contain neutral hex ${hex}`).toBe(false);
  }
}

describe("FAZ 35 Wave 13 — system health + PWA remaining surfaces", () => {
  it("targets all Wave 13 files in the repository", () => {
    for (const file of WAVE35_SYSTEM_HEALTH_PWA_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes raw branding shells from UI targets", () => {
    for (const file of WAVE35_SYSTEM_HEALTH_PWA_UI_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses existing ui-* primitives on UI targets", () => {
    expect(readSource("src/app/(dashboard)/sistem-saglik/page.tsx")).toMatch(/ui-page/);
    expect(readSource("src/app/(dashboard)/sistem-saglik/page.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx")).toMatch(/ui-kpi-band/);
    expect(readSource("src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx")).toMatch(/ui-btn-ghost/);
    expect(readSource("src/app/offline/page.tsx")).toMatch(/ui-page/);
    expect(readSource("src/app/offline/page.tsx")).toMatch(/ui-btn-primary/);
    expect(readSource("src/components/pwa/PwaInstallBanner.tsx")).toMatch(/ui-kpi-chip--brand/);
    expect(readSource("src/components/pwa/PwaInstallBanner.tsx")).toMatch(/ui-btn-primary/);
    expect(uiBrandingClasses.button.primary).toBe("ui-btn-primary");
  });

  it("tokenizes brand accent through existing CSS variables on UI targets", () => {
    const neutralOnlyFiles = [
      "src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx",
    ] as const;
    const primaryVarFiles = WAVE35_SYSTEM_HEALTH_PWA_UI_FILES.filter(
      (file) => !neutralOnlyFiles.includes(file as (typeof neutralOnlyFiles)[number])
    );
    for (const file of primaryVarFiles) {
      expect(readSource(file)).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    }
    expect(readSource(neutralOnlyFiles[0])).toMatch(/ui-kpi-band/);
  });

  it("binds manifest PWA colors to canonical defaults without raw hex literals", () => {
    const manifest = readSource("src/app/manifest.ts");
    expect(manifest).toMatch(/createDefaultBranding/);
    expect(manifest).toMatch(/defaultTheme\.background/);
    expect(manifest.includes("#")).toBe(false);
    expect(manifest).not.toMatch(/var\(--peaker-ui-/);
  });

  it("preserves semantic health/offline/PWA status colors and lifecycle hooks", () => {
    const healthPage = readSource("src/app/(dashboard)/sistem-saglik/page.tsx");
    expect(healthPage).toMatch(/text-green-400 border-green-500\/20 bg-green-500\/10/);
    expect(healthPage).toMatch(/text-red-400 border-red-500\/20 bg-red-500\/10/);
    expect(healthPage).toMatch(/bg-amber-500\/10 border border-amber-500\/30/);

    const integrityPanel = readSource("src/app/(dashboard)/sistem-saglik/ProfileIntegrityPanel.tsx");
    expect(integrityPanel).toMatch(/border-green-500\/30 bg-green-500\/15 text-green-300/);
    expect(integrityPanel).toMatch(/runProfileIntegrityRepairAction/);

    const banner = readSource("src/components/pwa/PwaInstallBanner.tsx");
    expect(banner).toMatch(/beforeinstallprompt/);
    expect(banner).toMatch(/localStorage\.setItem\(DISMISS_KEY/);
    expect(banner).toMatch(/deferred\.prompt\(\)/);
  });

  it("does not introduce new providers, tokens, or CSS namespaces", () => {
    for (const file of WAVE35_SYSTEM_HEALTH_PWA_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/createContext\(/);
      expect(source).not.toMatch(/EmptyStateCard/);
    }
  });
});
