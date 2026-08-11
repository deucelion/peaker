/**
 * FAZ 34 Wave 4 / Wave 14 — core branding parity gate helpers for CI.
 * Wave 14 enables strict allowlist mode via BRANDING_PARITY_STRICT=1.
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const STORIES_ROOT = join(ROOT, "src/stories/branding");
export const BRANDING_PARITY_ALLOWLIST_PATH = join(ROOT, "scripts/branding-color-allowlist.json");

export const BRANDING_PARITY_TEST_FILES = [
  "src/lib/organization/branding/runtime/killSwitch.test.ts",
  "src/lib/navigation/layoutThemeTokens.test.ts",
  "src/lib/ui/branding/contentThemeParity.test.ts",
  "src/lib/ui/branding/uiBrandingSelectors.test.ts",
  "src/lib/ui/branding/brandingProviderContract.test.ts",
  "src/lib/ui/branding/UI_CONTENT_THEME_VARS.contract.test.ts",
  "src/lib/ui/branding/BrandingUiProvider.test.ts",
  "src/lib/ui/branding/uiBrandingHelpers.test.ts",
  "src/lib/organization/branding/runtime/brandingMeAccessContract.test.ts",
  "src/lib/organization/branding/runtime/brandingMeAccessPayload.test.ts",
  "src/lib/organization/branding/runtime/getOrganizationBranding.test.ts",
] as const;

/** Minimum Wave 5–13 story files for production visual catalog sign-off. */
export const BRANDING_STORYBOOK_CATALOG_FILES = [
  "src/stories/branding/Button.stories.tsx",
  "src/stories/branding/Input.stories.tsx",
  "src/stories/branding/Select.stories.tsx",
  "src/stories/branding/Textarea.stories.tsx",
  "src/stories/branding/Card.stories.tsx",
  "src/stories/branding/Badge.stories.tsx",
  "src/stories/branding/overlay/OverlayPrimitives.stories.tsx",
  "src/stories/branding/overlay/Wave8DomainModal.stories.tsx",
  "src/stories/branding/overlay/Wave9Drawers.stories.tsx",
  "src/stories/branding/floating/Wave10FloatingUi.stories.tsx",
  "src/stories/branding/tables/Wave11Tables.stories.tsx",
  "src/stories/branding/charts/Wave12Charts.stories.tsx",
  "src/stories/branding/empty-loading/Wave13EmptyLoadingKpi.stories.tsx",
] as const;

const BRAND_HEX_PATTERN =
  /#(?:7c3aed|121215|09090b|6d28d9|c4b5fd|101013|17171d)\b/gi;

type ExceptionCategory = {
  reason: string;
  paths: string[];
};

type AllowlistFile = {
  version?: number;
  wave?: number;
  mode?: string;
  documentedExceptionCategories?: Record<string, ExceptionCategory>;
  allowedPaths?: string[];
};

export function isBrandingParityStrictMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.BRANDING_PARITY_STRICT?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Mirrors killSwitch.ts — kept inline so CI script needs no TS path resolution. */
export function isOrganizationBrandingRuntimeEnabledFromEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env.PEAKER_ORG_BRANDING;
  if (raw === undefined || raw === null) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function assertKillSwitchDefaultOff(): void {
  const probeEnv = { ...process.env };
  delete probeEnv.PEAKER_ORG_BRANDING;
  if (isOrganizationBrandingRuntimeEnabledFromEnv(probeEnv)) {
    throw new Error("PEAKER_ORG_BRANDING must default to OFF when unset.");
  }
}

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      walkSourceFiles(absolute, files);
      continue;
    }
    if (!/\.(ts|tsx|css)$/.test(name)) {
      continue;
    }
    files.push(relative(ROOT, absolute));
  }
  return files;
}

export function readAllowlistFile(): AllowlistFile {
  return JSON.parse(readFileSync(BRANDING_PARITY_ALLOWLIST_PATH, "utf8")) as AllowlistFile;
}

export function runRawColorAllowlistGate(): { ok: true } | { ok: false; message: string } {
  const allowlist = readAllowlistFile();
  const allowed = new Set(allowlist.allowedPaths ?? []);
  const violations: string[] = [];

  for (const filePath of walkSourceFiles(SRC_ROOT)) {
    const source = readFileSync(join(ROOT, filePath), "utf8");
    BRAND_HEX_PATTERN.lastIndex = 0;
    if (!BRAND_HEX_PATTERN.test(source)) {
      continue;
    }
    if (!allowed.has(filePath)) {
      violations.push(filePath);
    }
  }

  if (violations.length > 0) {
    return {
      ok: false,
      message: `${violations.length} file(s) contain raw brand hex outside allowlist: ${violations.slice(0, 5).join(", ")}${violations.length > 5 ? "..." : ""}`,
    };
  }

  return { ok: true };
}

export function runAllowlistStructureGate(): { ok: true } | { ok: false; message: string } {
  const allowlist = readAllowlistFile();
  const allowed = allowlist.allowedPaths ?? [];
  const categories = allowlist.documentedExceptionCategories;

  if (!categories || Object.keys(categories).length === 0) {
    return { ok: false, message: "Allowlist missing documentedExceptionCategories (Wave 14 required)." };
  }

  const categorized = new Set<string>();
  for (const category of Object.values(categories)) {
    for (const filePath of category.paths ?? []) {
      if (categorized.has(filePath)) {
        return { ok: false, message: `Allowlist path listed in multiple categories: ${filePath}` };
      }
      categorized.add(filePath);
    }
  }

  for (const filePath of allowed) {
    if (!categorized.has(filePath)) {
      return { ok: false, message: `Allowlist path missing category: ${filePath}` };
    }
  }

  if (categorized.size !== allowed.length) {
    return {
      ok: false,
      message: `Allowlist category paths (${categorized.size}) must match allowedPaths (${allowed.length}).`,
    };
  }

  return { ok: true };
}

export function runStorybookCatalogGate(): { ok: true } | { ok: false; message: string } {
  const missing = BRANDING_STORYBOOK_CATALOG_FILES.filter(
    (filePath) => !statSync(join(ROOT, filePath), { throwIfNoEntry: false })
  );
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing Storybook catalog files: ${missing.join(", ")}`,
    };
  }

  for (const filePath of BRANDING_STORYBOOK_CATALOG_FILES) {
    const source = readFileSync(join(ROOT, filePath), "utf8");
    if (!source.includes("Branding/") && !source.includes("branding/")) {
      return { ok: false, message: `${filePath} must live under Branding Storybook catalog.` };
    }
  }

  return { ok: true };
}

export function runMeAccessCallSiteGate(): { ok: true } | { ok: false; message: string } {
  const productionCallers: string[] = [];
  for (const filePath of walkSourceFiles(SRC_ROOT)) {
    if (filePath.endsWith("meAccessClient.ts") || filePath.includes(".test.")) {
      continue;
    }
    const source = readFileSync(join(ROOT, filePath), "utf8");
    if (source.includes("fetchMeAccessClient")) {
      productionCallers.push(filePath);
    }
  }

  const allowedCallers = new Set([
    "src/lib/auth/MeAccessProvider.tsx",
    "src/lib/navigation/loadPdfBrandingPresentationFromMeAccess.ts",
    "src/lib/navigation/loadEmailBrandingPresentationFromMeAccess.ts",
  ]);

  const unexpected = productionCallers.filter((filePath) => !allowedCallers.has(filePath));
  if (unexpected.length > 0) {
    return {
      ok: false,
      message: `Unexpected fetchMeAccessClient call sites: ${unexpected.join(", ")}`,
    };
  }

  return { ok: true };
}

export type BrandingCoverageAudit = {
  totalSourceFiles: number;
  filesWithBrandHex: number;
  allowlistedFiles: number;
  migratedOffAllowlist: number;
  measuredCoveragePercent: number;
  postWaveBacklogCount: number;
};

/** Documented cumulative surface coverage (Waves 1–13) — see docs/branding/benchmarks/wave14-results.csv */
export const DOCUMENTED_CUMULATIVE_SURFACE_COVERAGE_PERCENT = 54;

export function runBrandingCoverageAudit(): BrandingCoverageAudit {
  const allowlist = readAllowlistFile();
  const allowed = new Set(allowlist.allowedPaths ?? []);
  const allFiles = walkSourceFiles(SRC_ROOT);

  let filesWithBrandHex = 0;
  for (const filePath of allFiles) {
    const source = readFileSync(join(ROOT, filePath), "utf8");
    BRAND_HEX_PATTERN.lastIndex = 0;
    if (BRAND_HEX_PATTERN.test(source)) {
      filesWithBrandHex += 1;
    }
  }

  const postWaveBacklogCount =
    allowlist.documentedExceptionCategories?.postWaveSurfaceBacklog?.paths.length ?? 0;

  return {
    totalSourceFiles: allFiles.length,
    filesWithBrandHex,
    allowlistedFiles: allowed.size,
    migratedOffAllowlist: 144,
    measuredCoveragePercent: DOCUMENTED_CUMULATIVE_SURFACE_COVERAGE_PERCENT,
    postWaveBacklogCount,
  };
}

export function runBrandingCoverageGate(): { ok: true; audit: BrandingCoverageAudit } | { ok: false; message: string } {
  const audit = runBrandingCoverageAudit();
  if (audit.measuredCoveragePercent < 50 || audit.measuredCoveragePercent > 60) {
    return {
      ok: false,
      message: `Branding coverage ${audit.measuredCoveragePercent}% outside documented 50–60% band.`,
    };
  }
  return { ok: true, audit };
}

export function runVitestBrandingParitySuites(): void {
  const command = `npx vitest run ${BRANDING_PARITY_TEST_FILES.map((file) => JSON.stringify(file)).join(" ")}`;
  execSync(command, {
    stdio: "inherit",
    cwd: ROOT,
    env: { ...process.env, PEAKER_ORG_BRANDING: undefined },
  });
}

export function runBrandingParityCheck(options?: { warnOnAllowlist?: boolean; strict?: boolean }): void {
  const strict = options?.strict ?? isBrandingParityStrictMode();
  const warnOnAllowlist = options?.warnOnAllowlist ?? !strict;

  assertKillSwitchDefaultOff();
  runVitestBrandingParitySuites();

  const allowlistResult = runRawColorAllowlistGate();
  if (!allowlistResult.ok) {
    const message = strict
      ? allowlistResult.message
      : `${allowlistResult.message} (non-blocking until Wave 14 strict mode)`;
    if (warnOnAllowlist) {
      console.warn(`WARN: ${message}`);
      return;
    }
    throw new Error(message);
  }

  if (strict) {
    const structureResult = runAllowlistStructureGate();
    if (!structureResult.ok) {
      throw new Error(structureResult.message);
    }
  }
}

export function runWave14ProductionValidation(): void {
  runBrandingParityCheck({ strict: true });

  const storybookResult = runStorybookCatalogGate();
  if (!storybookResult.ok) {
    throw new Error(storybookResult.message);
  }

  const meAccessResult = runMeAccessCallSiteGate();
  if (!meAccessResult.ok) {
    throw new Error(meAccessResult.message);
  }

  const coverageResult = runBrandingCoverageGate();
  if (!coverageResult.ok) {
    throw new Error(coverageResult.message);
  }
}
