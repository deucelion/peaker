import {
  BRANDING_ASSET_KIND_LIST,
  BRANDING_COLOR_TOKEN_KEY_LIST,
  BRANDING_SCHEMA_VERSION,
  isBrandingAssetKind,
  isBrandingColorTokenKey,
} from "./tokens";
import type {
  BrandingAssetReference,
  BrandingAssets,
  BrandingTheme,
  OrganizationBranding,
  ValidateBrandingResult,
} from "./types";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidBrandingColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function validateBrandingTokens(theme: BrandingTheme): ValidateBrandingResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const key of BRANDING_COLOR_TOKEN_KEY_LIST) {
    if (seen.has(key)) {
      errors.push(`Yinelenen token: ${key}`);
    }
    seen.add(key);

    const value = theme[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`Gecersiz token degeri: ${key}`);
      continue;
    }
    if (!isValidBrandingColor(value)) {
      errors.push(`Gecersiz renk formati: ${key}`);
    }
  }

  for (const key of Object.keys(theme)) {
    if (!isBrandingColorTokenKey(key)) {
      errors.push(`Bilinmeyen token: ${key}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateBrandingAssets(assets: BrandingAssets): ValidateBrandingResult {
  const errors: string[] = [];
  const seenAssetIds = new Set<string>();
  const seenKinds = new Set<string>();

  for (const kind of BRANDING_ASSET_KIND_LIST) {
    const asset = assets[kind];
    const assetErrors = validateBrandingAssetReference(asset, kind);
    errors.push(...assetErrors);

    if (seenAssetIds.has(asset.assetId)) {
      errors.push(`Yinelenen assetId: ${asset.assetId}`);
    }
    seenAssetIds.add(asset.assetId);

    if (seenKinds.has(asset.kind)) {
      errors.push(`Yinelenen asset kind: ${asset.kind}`);
    }
    seenKinds.add(asset.kind);
  }

  for (const key of Object.keys(assets)) {
    if (!isBrandingAssetKind(key)) {
      errors.push(`Bilinmeyen asset anahtari: ${key}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateBrandingAssetReference(
  asset: BrandingAssetReference,
  expectedKind?: BrandingAssetReference["kind"]
): string[] {
  const errors: string[] = [];

  if (typeof asset.assetId !== "string" || asset.assetId.trim().length === 0) {
    errors.push("assetId zorunludur.");
  }
  if (!isBrandingAssetKind(asset.kind)) {
    errors.push(`Gecersiz asset kind: ${String(asset.kind)}`);
  } else if (expectedKind && asset.kind !== expectedKind) {
    errors.push(`Asset kind uyumsuz: ${asset.kind} !== ${expectedKind}`);
  }
  if (typeof asset.storagePath !== "string" || asset.storagePath.trim().length === 0) {
    errors.push("storagePath zorunludur.");
  }
  if (typeof asset.contentType !== "string" || asset.contentType.trim().length === 0) {
    errors.push("contentType zorunludur.");
  }
  if (typeof asset.updatedAt !== "string" || Number.isNaN(Date.parse(asset.updatedAt))) {
    errors.push("updatedAt gecerli ISO tarih olmalidir.");
  }

  return errors;
}

export function validateBranding(branding: OrganizationBranding): ValidateBrandingResult {
  const errors: string[] = [];

  if (branding.schemaVersion !== BRANDING_SCHEMA_VERSION) {
    errors.push(`schemaVersion desteklenmiyor: ${String(branding.schemaVersion)}`);
  }

  if (!Number.isInteger(branding.brandingRevision) || branding.brandingRevision < 0) {
    errors.push("brandingRevision negatif olmayan tam sayi olmalidir.");
  }

  const tokenValidation = validateBrandingTokens(branding.theme);
  if (!tokenValidation.ok) {
    errors.push(...tokenValidation.errors);
  }

  const sidebarTokenValidation = validateBrandingSidebarTokens(branding.sidebar);
  if (!sidebarTokenValidation.ok) {
    errors.push(...sidebarTokenValidation.errors);
  }

  const assetValidation = validateBrandingAssets(branding.assets);
  if (!assetValidation.ok) {
    errors.push(...assetValidation.errors);
  }

  if (typeof branding.application.appName !== "string" || branding.application.appName.trim().length === 0) {
    errors.push("application.appName zorunludur.");
  }
  if (
    typeof branding.application.shortName !== "string" ||
    branding.application.shortName.trim().length === 0
  ) {
    errors.push("application.shortName zorunludur.");
  }

  if (typeof branding.pdf.title !== "string" || branding.pdf.title.trim().length === 0) {
    errors.push("pdf.title zorunludur.");
  }
  if (typeof branding.email.title !== "string" || branding.email.title.trim().length === 0) {
    errors.push("email.title zorunludur.");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateBrandingSidebarTokens(sidebar: OrganizationBranding["sidebar"]): ValidateBrandingResult {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(sidebar)) {
    if (key !== "background" && key !== "text" && key !== "active") {
      errors.push(`Bilinmeyen sidebar token: ${key}`);
      continue;
    }
    if (typeof value !== "string" || !isValidBrandingColor(value)) {
      errors.push(`Gecersiz sidebar renk: ${key}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function stripUnknownBrandingKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const allowedTopLevel = new Set([
    "schemaVersion",
    "brandingRevision",
    "theme",
    "assets",
    "application",
    "sidebar",
    "pdf",
    "email",
  ]);

  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (allowedTopLevel.has(key)) {
      stripped[key] = value;
    }
  }
  return stripped;
}

export function stripUnknownThemeKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isBrandingColorTokenKey(key)) {
      stripped[key] = value;
    }
  }
  return stripped;
}

export function stripUnknownAssetKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isBrandingAssetKind(key)) {
      stripped[key] = value;
    }
  }
  return stripped;
}

export function readNonEmptyStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function readNonNegativeIntOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}
