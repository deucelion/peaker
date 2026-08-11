import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

const REPO_ROOT = join(__dirname, "../../..");

/** FAZ 35 Wave 11 — super-admin, auth/account, audit/table, schedule residuals */
export const WAVE35_SUPER_ADMIN_AUTH_REMAINING_FILES = [
  "src/app/(auth)/login/page.tsx",
  "src/app/(dashboard)/anket/page.tsx",
  "src/app/(dashboard)/audit-log/page.tsx",
  "src/app/(dashboard)/error.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/SelectPremium.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyMobileList.tsx",
  "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyRecentCreatedPulse.tsx",
  "src/app/(dashboard)/sporcu/page.tsx",
  "src/app/(dashboard)/sporcular/yeni/page.tsx",
  "src/app/(dashboard)/super-admin/SuperAdminAddCoachForm.tsx",
  "src/app/(dashboard)/super-admin/SuperAdminCreateOrgForm.tsx",
  "src/app/(dashboard)/super-admin/SuperAdminLicensePanel.tsx",
  "src/app/(dashboard)/super-admin/SuperAdminOrgLifecyclePanel.tsx",
  "src/app/(dashboard)/super-admin/SuperAdminOrgUsersPasswordPanel.tsx",
  "src/app/(dashboard)/super-admin/[organizationId]/branding/page.tsx",
  "src/app/(dashboard)/super-admin/[organizationId]/page.tsx",
  "src/app/(dashboard)/super-admin/_components/OrgBrandingEditor.tsx",
  "src/app/(dashboard)/super-admin/error.tsx",
  "src/app/(dashboard)/super-admin/page.tsx",
  "src/app/auth/callback/page.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/koc-hesap-durumu/page.tsx",
  "src/app/org-durumu/page.tsx",
  "src/app/sifre-guncelleme/page.tsx",
  "src/app/sporcu-hesap-durumu/page.tsx",
  "src/app/yonetici-hesap-durumu/page.tsx",
  "src/lib/audit/labels.ts",
] as const;

export const WAVE35_SUPER_ADMIN_AUTH_REMAINING_ALLOWLIST_REMOVALS = [
  ...WAVE35_SUPER_ADMIN_AUTH_REMAINING_FILES,
] as const;

const RAW_SHELL_PATTERNS = [
  "bg-black/20",
  "bg-black/30",
  "bg-black/40",
  "bg-white/5",
  "border-white/10",
  "border-white/15",
] as const;

const FORBIDDEN_NEUTRAL_HEX = [
  "121215",
  "17171d",
  "7c3aed",
  "c4b5fd",
  "6d28d9",
  "ddd6fe",
  "e9d5ff",
] as const;

const SEMANTIC_STATUS_MARKERS = [
  "border-emerald-",
  "border-amber-",
  "border-rose-",
  "border-red-",
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

describe("FAZ 35 Wave 11 — super-admin / auth / remaining high-risk surfaces", () => {
  it("targets all Wave 11 files in the repository", () => {
    for (const file of WAVE35_SUPER_ADMIN_AUTH_REMAINING_FILES) {
      expect(existsSync(join(REPO_ROOT, file)), `${file} must exist`).toBe(true);
    }
  });

  it("removes raw branding shells from all Wave 11 targets", () => {
    for (const file of WAVE35_SUPER_ADMIN_AUTH_REMAINING_FILES) {
      assertNoRawBrandingShells(readSource(file), file);
    }
  });

  it("uses existing card, input, button, table, and overlay primitives", () => {
    expect(readSource("src/app/(auth)/login/page.tsx")).toMatch(/ui-card/);
    expect(readSource("src/app/(auth)/login/page.tsx")).toMatch(/ui-input/);
    expect(readSource("src/app/(auth)/login/page.tsx")).toMatch(/ui-btn-primary/);

    expect(readSource("src/app/(dashboard)/audit-log/page.tsx")).toMatch(/DataTable/);
    expect(readSource("src/app/(dashboard)/audit-log/page.tsx")).toMatch(/EmptyState/);
    expect(readSource("src/app/(dashboard)/audit-log/page.tsx")).toMatch(/OverlayDrawer/);
    expect(readSource("src/app/(dashboard)/audit-log/page.tsx")).toMatch(/ui-input/);

    expect(readSource("src/app/(dashboard)/super-admin/page.tsx")).toMatch(/ui-page|ui-card/);
    expect(readSource("src/app/(dashboard)/super-admin/_components/OrgBrandingEditor.tsx")).toMatch(/ui-input/);

    expect(uiBrandingClasses.card.base).toBe("ui-card");
    expect(uiBrandingClasses.button.primary).toBe("ui-btn-primary");
  });

  it("tokenizes brand primary through existing CSS variables", () => {
    const neutralOnlyShellFiles = [
      "src/app/(dashboard)/haftalik-ders-programi/_components/WeeklyMobileList.tsx",
      "src/app/(dashboard)/super-admin/SuperAdminOrgLifecyclePanel.tsx",
    ] as const;
    const primaryVarFiles = WAVE35_SUPER_ADMIN_AUTH_REMAINING_ALLOWLIST_REMOVALS.filter(
      (file) => file !== "src/lib/audit/labels.ts" && !neutralOnlyShellFiles.includes(file as (typeof neutralOnlyShellFiles)[number])
    );
    for (const file of primaryVarFiles) {
      expect(readSource(file)).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    }
    expect(readSource("src/lib/audit/labels.ts")).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    expect(readSource(neutralOnlyShellFiles[0])).toMatch(/ui-card/);
    expect(readSource(neutralOnlyShellFiles[1])).toMatch(/ui-card|ui-kpi-band/);
  });

  it("preserves semantic audit and status colors", () => {
    const labels = readSource("src/lib/audit/labels.ts");
    expect(labels).toMatch(/destructive: "border-red-500\/30 bg-red-500\/10 text-red-200"/);
    expect(labels).toMatch(/creation: "border-emerald-500\/30 bg-emerald-500\/10 text-emerald-200"/);
    expect(labels).toMatch(/permission: "border-amber-500\/30 bg-amber-500\/10 text-amber-200"/);

    const auditPage = readSource("src/app/(dashboard)/audit-log/page.tsx");
    expect(auditPage).toMatch(/actionToneClass/);

    const withSemantic = WAVE35_SUPER_ADMIN_AUTH_REMAINING_FILES.filter((file) => {
      const source = readSource(file);
      return SEMANTIC_STATUS_MARKERS.some((marker) => source.includes(marker));
    });
    expect(withSemantic.length).toBeGreaterThanOrEqual(2);
  });

  it("does not introduce deprecated primitives or new branding providers", () => {
    for (const file of WAVE35_SUPER_ADMIN_AUTH_REMAINING_FILES) {
      const source = readSource(file);
      expect(source).not.toMatch(/EmptyStateCard/);
      expect(source).not.toMatch(/BrandingUiProvider/);
      expect(source).not.toMatch(/createContext\(/);
    }
  });
});
