import { BRANDING_ASSET_KINDS } from "../tokens";
import type { BrandingAssetKind, BrandingAssetReference, OrganizationBranding } from "../types";
import { validateBrandingAssetReference } from "../validation";
import { BRANDING_CANONICAL_SECTION_REFS, type BrandingCanonicalSectionRef } from "./types";

const ASSET_SECTION_BY_REF: Partial<Record<BrandingCanonicalSectionRef, BrandingAssetKind>> = {
  [BRANDING_CANONICAL_SECTION_REFS.assetsLogo]: BRANDING_ASSET_KINDS.logo,
  [BRANDING_CANONICAL_SECTION_REFS.assetsFavicon]: BRANDING_ASSET_KINDS.favicon,
};

function isBrandingAssetReference(value: unknown): value is BrandingAssetReference {
  if (!value || typeof value !== "object") {
    return false;
  }
  return validateBrandingAssetReference(value as BrandingAssetReference).length === 0;
}

export function readBrandingAssetSection(
  branding: OrganizationBranding,
  sectionRef: BrandingCanonicalSectionRef,
  expectedKind: BrandingAssetKind
): BrandingAssetReference {
  const mappedKind = ASSET_SECTION_BY_REF[sectionRef];
  if (mappedKind !== expectedKind) {
    throw new Error(`Unsupported branding asset section: ${sectionRef}`);
  }

  const asset = branding.assets?.[expectedKind];
  if (!isBrandingAssetReference(asset)) {
    throw new Error(`Invalid branding asset section: ${sectionRef}`);
  }

  const errors = validateBrandingAssetReference(asset, expectedKind);
  if (errors.length > 0) {
    throw new Error(`Invalid branding asset reference: ${sectionRef}`);
  }

  return asset;
}
