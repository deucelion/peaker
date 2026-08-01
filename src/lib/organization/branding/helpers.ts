import { createDefaultBranding } from "./defaults";
import { BRANDING_ASSET_KIND_LIST, BRANDING_COLOR_TOKEN_KEY_LIST, isBrandingAssetKind } from "./tokens";
import type {
  BrandingApplication,
  BrandingAssetReference,
  BrandingAssets,
  BrandingEmail,
  BrandingPdf,
  BrandingSidebar,
  BrandingTheme,
  OrganizationBranding,
} from "./types";
import { readNonEmptyStringOrUndefined, validateBrandingAssetReference } from "./validation";

export { createDefaultBranding };

export function cloneBranding(branding: OrganizationBranding): OrganizationBranding {
  return Object.freeze({
    schemaVersion: branding.schemaVersion,
    brandingRevision: branding.brandingRevision,
    theme: Object.freeze({ ...branding.theme }),
    assets: Object.freeze({
      logo: Object.freeze({ ...branding.assets.logo }),
      mark: Object.freeze({ ...branding.assets.mark }),
      favicon: Object.freeze({ ...branding.assets.favicon }),
    }),
    application: Object.freeze({ ...branding.application }),
    sidebar: Object.freeze({ ...branding.sidebar }),
    pdf: Object.freeze({ ...branding.pdf }),
    email: Object.freeze({ ...branding.email }),
  });
}

export function mergeBrandingThemeFromPartial(
  base: BrandingTheme,
  partial: Record<string, unknown>
): BrandingTheme {
  const next = { ...base };
  for (const key of BRANDING_COLOR_TOKEN_KEY_LIST) {
    const value = readNonEmptyStringOrUndefined(partial[key]);
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return Object.freeze(next);
}

export function parseBrandingAssetReference(
  raw: unknown,
  fallback: BrandingAssetReference
): BrandingAssetReference {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fallback;
  }

  const record = raw as Record<string, unknown>;
  const candidate: BrandingAssetReference = {
    assetId: readNonEmptyStringOrUndefined(record.assetId) ?? fallback.assetId,
    kind:
      typeof record.kind === "string" && isBrandingAssetKind(record.kind)
        ? record.kind
        : fallback.kind,
    storagePath: readNonEmptyStringOrUndefined(record.storagePath) ?? fallback.storagePath,
    contentType: readNonEmptyStringOrUndefined(record.contentType) ?? fallback.contentType,
    updatedAt: readNonEmptyStringOrUndefined(record.updatedAt) ?? fallback.updatedAt,
  };

  if (validateBrandingAssetReference(candidate).length > 0) {
    return fallback;
  }

  return Object.freeze(candidate);
}

export function mergeBrandingAssetsFromPartial(
  base: BrandingAssets,
  partial: Record<string, unknown>
): BrandingAssets {
  let logo = base.logo;
  let mark = base.mark;
  let favicon = base.favicon;

  for (const kind of BRANDING_ASSET_KIND_LIST) {
    if (partial[kind] === undefined) {
      continue;
    }
    const parsed = parseBrandingAssetReference(partial[kind], base[kind]);
    if (kind === "logo") logo = parsed;
    else if (kind === "mark") mark = parsed;
    else favicon = parsed;
  }

  return { logo, mark, favicon };
}

export function mergeBrandingAssetReferences(
  base: BrandingAssetReference,
  patch: Partial<BrandingAssetReference>
): BrandingAssetReference {
  return Object.freeze({
    assetId: patch.assetId ?? base.assetId,
    kind: patch.kind ?? base.kind,
    storagePath: patch.storagePath ?? base.storagePath,
    contentType: patch.contentType ?? base.contentType,
    updatedAt: patch.updatedAt ?? base.updatedAt,
  });
}

export function mergeBrandingSectionFromPartial<T extends { [K in keyof T]: string }>(
  base: T,
  partial: unknown
): T {
  if (typeof partial !== "object" || partial === null || Array.isArray(partial)) {
    return Object.freeze({ ...base });
  }

  const next = { ...base };
  for (const key of Object.keys(base) as Array<keyof T>) {
    const value = readNonEmptyStringOrUndefined((partial as Record<string, unknown>)[key as string]);
    if (value !== undefined) {
      next[key] = value as T[keyof T];
    }
  }
  return Object.freeze(next);
}

export function mergeBranding(
  base: OrganizationBranding,
  patch: Partial<{
    brandingRevision: number;
    theme: Partial<BrandingTheme>;
    assets: Partial<Record<keyof BrandingAssets, Partial<BrandingAssetReference>>>;
    application: Partial<OrganizationBranding["application"]>;
    sidebar: Partial<OrganizationBranding["sidebar"]>;
    pdf: Partial<OrganizationBranding["pdf"]>;
    email: Partial<OrganizationBranding["email"]>;
  }>
): OrganizationBranding {
  const themePartial: Record<string, unknown> = patch.theme ? { ...patch.theme } : {};
  const assetsPartial: Record<string, unknown> = {};

  if (patch.assets) {
    for (const kind of BRANDING_ASSET_KIND_LIST) {
      const assetPatch = patch.assets[kind];
      if (assetPatch) {
        assetsPartial[kind] = mergeBrandingAssetReferences(base.assets[kind], assetPatch);
      }
    }
  }

  return Object.freeze({
    schemaVersion: base.schemaVersion,
    brandingRevision: patch.brandingRevision ?? base.brandingRevision,
    theme: mergeBrandingThemeFromPartial(base.theme, themePartial),
    assets: mergeBrandingAssetsFromPartial(base.assets, assetsPartial),
    application: mergeBrandingSectionFromPartial<BrandingApplication>(base.application, patch.application),
    sidebar: mergeBrandingSectionFromPartial<BrandingSidebar>(base.sidebar, patch.sidebar),
    pdf: mergeBrandingSectionFromPartial<BrandingPdf>(base.pdf, patch.pdf),
    email: mergeBrandingSectionFromPartial<BrandingEmail>(base.email, patch.email),
  });
}

export function isBrandingEqual(a: OrganizationBranding, b: OrganizationBranding): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
