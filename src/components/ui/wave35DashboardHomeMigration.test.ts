import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 4 — dashboard home & entry surface migration targets */
export const WAVE35_DASHBOARD_HOME_FILES = [
  "src/app/(dashboard)/page.tsx",
  "src/app/(dashboard)/koclar/page.tsx",
  "src/app/(dashboard)/notlar-haftalik-program/page.tsx",
  "src/app/(dashboard)/bildirimler/page.tsx",
  "src/app/(dashboard)/bildirimler/_components/NotificationPreferencesPanel.tsx",
] as const;

const RAW_SHELL_PATTERNS = ["bg-black/20", "bg-black/30", "from-purple", "to-purple"] as const;

const SEMANTIC_PRESERVATION_MARKERS = [
  "from-emerald-",
  "from-amber-",
  "from-blue-",
  "border-amber-",
  "border-emerald-",
  "border-rose-",
  "border-red-",
  "text-amber-",
  "text-emerald-",
  "text-green-",
  "ui-badge-success",
  "ui-badge-danger",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function assertNoRawBrandingShells(source: string, file: string) {
  for (const pattern of RAW_SHELL_PATTERNS) {
    expect(source.includes(pattern), `${file} must not contain raw shell ${pattern}`).toBe(false);
  }
  for (const hex of ["121215", "7c3aed", "c4b5fd", "6d28d9", "101013"] as const) {
    expect(source.includes(hex), `${file} must not contain neutral hex ${hex}`).toBe(false);
  }
}

describe("FAZ 35 Wave 4 — dashboard home migration", () => {
  it("removes raw branding shells from all Wave 4 targets", () => {
    for (const file of WAVE35_DASHBOARD_HOME_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses ui-card and ui-kpi primitives on dashboard entry surfaces", () => {
    expect(readSource("src/app/(dashboard)/page.tsx")).toMatch(/ui-card|ui-kpi-card|ui-kpi-section/);
    expect(readSource("src/app/(dashboard)/koclar/page.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/notlar-haftalik-program/page.tsx")).toMatch(/ui-card|ui-card-inner/);
    expect(readSource("src/app/(dashboard)/bildirimler/page.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(dashboard)/bildirimler/_components/NotificationPreferencesPanel.tsx")).toMatch(
      /ui-card|ui-card-inner/
    );
    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.kpi.card).toBe("ui-kpi-card");
  });

  it("adopts EmptyState instead of EmptyStateCard on entry pages", () => {
    for (const file of [
      "src/app/(dashboard)/page.tsx",
      "src/app/(dashboard)/koclar/page.tsx",
      "src/app/(dashboard)/notlar-haftalik-program/page.tsx",
      "src/app/(dashboard)/bildirimler/page.tsx",
    ] as const) {
      const source = readSource(file);
      expect(source).toMatch(/EmptyState/);
      expect(source).not.toMatch(/EmptyStateCard/);
    }
  });

  it("uses ui-input, ui-select, and ui-btn primitives on forms and actions", () => {
    expect(readSource("src/app/(dashboard)/page.tsx")).toMatch(/ui-input|ui-select|ui-btn-primary|ui-btn-secondary/);
    expect(readSource("src/app/(dashboard)/koclar/page.tsx")).toMatch(/ui-input|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/notlar-haftalik-program/page.tsx")).toMatch(/ui-input|ui-select|ui-btn-primary/);
    expect(readSource("src/app/(dashboard)/bildirimler/_components/NotificationPreferencesPanel.tsx")).toMatch(
      /ui-btn-primary/
    );
  });

  it("tokenizes notification preferences panel shell", () => {
    const panel = readSource("src/app/(dashboard)/bildirimler/_components/NotificationPreferencesPanel.tsx");
    expect(panel).toMatch(/ui-card/);
    expect(panel).toMatch(/ui-card-inner/);
    expect(panel).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    expect(panel).toMatch(/peer-checked:bg-emerald-500/);
  });

  it("preserves StatCard semantic gradients and dashboard KPI colors", () => {
    const home = readSource("src/app/(dashboard)/page.tsx");
    expect(home).toMatch(/from-emerald-500 to-green-900/);
    expect(home).toMatch(/from-amber-500 to-orange-900/);
    expect(home).toMatch(/from-blue-600 to-indigo-900/);
    expect(home).toMatch(/border-amber-500\/20 bg-amber-500\/10/);
    expect(home).toMatch(/var\(--peaker-ui-PRIMARY\)/);

    const notes = readSource("src/app/(dashboard)/notlar-haftalik-program/page.tsx");
    expect(notes).toMatch(/border-emerald-500|border-amber-500|text-green-400/);

    const coaches = readSource("src/app/(dashboard)/koclar/page.tsx");
    expect(coaches).toMatch(/ui-badge-success|ui-badge-danger/);
  });
});
