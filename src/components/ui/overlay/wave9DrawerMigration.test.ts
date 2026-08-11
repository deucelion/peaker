import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OVERLAY_Z, overlayZIndex } from "./overlayZIndex";

const REPO_ROOT = join(__dirname, "../../../..");

/** Wave 9 migration targets — see docs/branding/wave-09.md */
export const WAVE9_DRAWER_FILES = [
  "src/components/finance/FinanceFilterDrawer.tsx",
  "src/components/finance/TahsilatRecordSheet.tsx",
  "src/app/(dashboard)/audit-log/page.tsx",
  "src/components/offline/SyncStatusCenter.tsx",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function grepRepo(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of WAVE9_DRAWER_FILES) {
    if (pattern.test(readSource(file))) {
      hits.push(file);
    }
  }
  return hits;
}

describe("Wave 9 drawer/sheet migration", () => {
  it("migrates scoped files to OverlayDrawer or OverlaySheet", () => {
    const financeFilter = readSource("src/components/finance/FinanceFilterDrawer.tsx");
    expect(financeFilter).toMatch(/OverlayDrawer/);

    const tahsilat = readSource("src/components/finance/TahsilatRecordSheet.tsx");
    expect(tahsilat).toMatch(/OverlaySheet/);

    const audit = readSource("src/app/(dashboard)/audit-log/page.tsx");
    expect(audit).toMatch(/OverlayDrawer/);

    const sync = readSource("src/components/offline/SyncStatusCenter.tsx");
    expect(sync).toMatch(/OverlaySheet/);
  });

  it("removes inline fixed drawer/sheet shells", () => {
    for (const file of WAVE9_DRAWER_FILES) {
      const source = readSource(file);
      expect(source, `${file} must not keep inline fixed overlay shells`).not.toMatch(
        /fixed inset-0 z-\[?\d/
      );
      expect(source, `${file} must not keep fixed aside drawers`).not.toMatch(
        /fixed inset-y-0 right-0 z-/
      );
    }
  });

  it("uses OVERLAY_Z registry in every migrated file", () => {
    for (const file of WAVE9_DRAWER_FILES) {
      expect(readSource(file), `${file} must reference OVERLAY_Z`).toMatch(/OVERLAY_Z\./);
    }
  });

  it("uses OverlayFooter on action drawers/sheets", () => {
    expect(readSource("src/components/finance/FinanceFilterDrawer.tsx")).toMatch(/OverlayFooter/);
    expect(readSource("src/components/offline/SyncStatusCenter.tsx")).toMatch(/OverlayFooter/);
  });

  it("preserves responsive tahsilat sheet (bottom mobile, right desktop)", () => {
    const tahsilat = readSource("src/components/finance/TahsilatRecordSheet.tsx");
    expect(tahsilat).toMatch(/rounded-t-2xl/);
    expect(tahsilat).toMatch(/sm:rounded-l-2xl/);
    expect(tahsilat).toMatch(/sm:!items-stretch sm:!justify-end/);
  });

  it("places offline sync center on DRAWER_PRIORITY layer", () => {
    const sync = readSource("src/components/offline/SyncStatusCenter.tsx");
    expect(sync).toMatch(/OVERLAY_Z\.DRAWER_PRIORITY/);
    expect(overlayZIndex(OVERLAY_Z.DRAWER_PRIORITY)).toBe(130);
  });

  it("binds escape-to-close via overlay primitives", () => {
    expect(readSource("src/components/finance/FinanceFilterDrawer.tsx")).toMatch(/onClose=\{onClose\}/);
    expect(readSource("src/components/offline/SyncStatusCenter.tsx")).toMatch(/onClose=\{onClose\}/);
  });

  it("removes PendingActionsDrawer from codebase exports", () => {
    const offlineIndex = readSource("src/components/offline/index.ts");
    expect(offlineIndex).not.toMatch(/PendingActionsDrawer/);
    expect(() => readSource("src/components/offline/PendingActionsDrawer.tsx")).toThrow();
  });

  it("keeps SyncStatusCenter as sole offline drawer in DashboardOfflineShell", () => {
    const shell = readSource("src/components/offline/DashboardOfflineShell.tsx");
    expect(shell).toMatch(/SyncStatusCenter/);
    expect(shell).not.toMatch(/PendingActionsDrawer/);
  });
});

describe("Wave 9 PendingActionsDrawer grep zero", () => {
  it("has no runtime references to PendingActionsDrawer in src", () => {
    const srcFiles = [
      ...WAVE9_DRAWER_FILES,
      "src/components/offline/index.ts",
      "src/components/offline/DashboardOfflineShell.tsx",
    ];
    for (const file of srcFiles) {
      expect(readSource(file)).not.toMatch(/PendingActionsDrawer/);
    }
  });
});
