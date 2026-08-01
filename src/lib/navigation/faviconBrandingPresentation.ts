import type { FaviconBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolveFaviconBranding";
import type { BrandingAssetReference } from "@/lib/organization/branding/types";

export type FaviconBrandingModel = {
  asset: BrandingAssetReference;
  href: string;
};

export function createFaviconBrandingModel(snapshot: FaviconBrandingSnapshot): FaviconBrandingModel {
  const href = snapshot.favicon.storagePath.startsWith("/")
    ? snapshot.favicon.storagePath
    : `/${snapshot.favicon.storagePath}`;

  return {
    asset: snapshot.favicon,
    href,
  };
}
