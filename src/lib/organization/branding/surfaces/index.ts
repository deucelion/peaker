export type {
  BrandingAssetSectionPath,
  BrandingCanonicalSectionRef,
  BrandingNestedAssetSectionRef,
  BrandingSurfaceKind,
  BrandingTopLevelSectionPath,
  LayoutSurfaceId,
  SidebarSurfaceId,
  LogoSurfaceId,
  FaviconSurfaceId,
  PdfSurfaceId,
  EmailSurfaceId,
  MetadataSurfaceId,
  SurfaceBrandingMap,
} from "./types";

export {
  BRANDING_ASSET_SECTION_PATHS,
  BRANDING_CANONICAL_SECTION_REF_LIST,
  BRANDING_CANONICAL_SECTION_REFS,
  BRANDING_SECTION_PATHS,
  BRANDING_SURFACE_KINDS,
} from "./types";

export {
  assertBrandingSurfaceMapCompleteness,
  assertNoDuplicateSurfaceIds,
  assertSurfaceBrandingMapContract,
  assertUniqueSurfaceBrandingMapKeys,
  collectDuplicateSurfaceIdIssues,
  collectSurfaceBrandingMapContractIssues,
  isCanonicalBrandingSectionRef,
} from "./contractValidation";
export type { SurfaceBrandingMapContractIssue } from "./contractValidation";

export { resolveLayoutBranding } from "./resolveLayoutBranding";
export type { LayoutBrandingSnapshot } from "./resolveLayoutBranding";
export { resolveSidebarBranding } from "./resolveSidebarBranding";
export type { SidebarBrandingSnapshot } from "./resolveSidebarBranding";
export { resolveLogoBranding } from "./resolveLogoBranding";
export type { LogoBrandingSnapshot } from "./resolveLogoBranding";
export { resolveMetadataBranding } from "./resolveMetadataBranding";
export type { MetadataBrandingSnapshot } from "./resolveMetadataBranding";
export { resolveFaviconBranding } from "./resolveFaviconBranding";
export type { FaviconBrandingSnapshot } from "./resolveFaviconBranding";
export { resolvePdfBranding } from "./resolvePdfBranding";
export type { PdfBrandingSnapshot } from "./resolvePdfBranding";
export { resolveEmailBranding } from "./resolveEmailBranding";
export type { EmailBrandingSnapshot } from "./resolveEmailBranding";
export { LAYOUT_BRANDING_MAP, LAYOUT_SURFACE_IDS } from "./layoutBrandingMap";
export { SIDEBAR_BRANDING_MAP, SIDEBAR_SURFACE_IDS } from "./sidebarBrandingMap";
export { LOGO_BRANDING_MAP, LOGO_SURFACE_IDS } from "./logoBrandingMap";
export { FAVICON_BRANDING_MAP, FAVICON_SURFACE_IDS } from "./faviconBrandingMap";
export { PDF_BRANDING_MAP, PDF_SURFACE_IDS } from "./pdfBrandingMap";
export { EMAIL_BRANDING_MAP, EMAIL_SURFACE_IDS } from "./emailBrandingMap";
export { METADATA_BRANDING_MAP, METADATA_SURFACE_IDS } from "./metadataBrandingMap";

import type { BrandingCanonicalSectionRef } from "./types";
import { EMAIL_BRANDING_MAP } from "./emailBrandingMap";
import { FAVICON_BRANDING_MAP } from "./faviconBrandingMap";
import { LAYOUT_BRANDING_MAP } from "./layoutBrandingMap";
import { LOGO_BRANDING_MAP } from "./logoBrandingMap";
import { METADATA_BRANDING_MAP } from "./metadataBrandingMap";
import { PDF_BRANDING_MAP } from "./pdfBrandingMap";
import { SIDEBAR_BRANDING_MAP } from "./sidebarBrandingMap";

/** Tum branding surface map kayitlari — contract validation icin tek kaynak. */
export const BRANDING_SURFACE_MAP_REGISTRY = [
  { mapName: "LAYOUT_BRANDING_MAP", map: LAYOUT_BRANDING_MAP },
  { mapName: "SIDEBAR_BRANDING_MAP", map: SIDEBAR_BRANDING_MAP },
  { mapName: "LOGO_BRANDING_MAP", map: LOGO_BRANDING_MAP },
  { mapName: "FAVICON_BRANDING_MAP", map: FAVICON_BRANDING_MAP },
  { mapName: "PDF_BRANDING_MAP", map: PDF_BRANDING_MAP },
  { mapName: "EMAIL_BRANDING_MAP", map: EMAIL_BRANDING_MAP },
  { mapName: "METADATA_BRANDING_MAP", map: METADATA_BRANDING_MAP },
] as const satisfies readonly {
  mapName: string;
  map: Readonly<Record<string, BrandingCanonicalSectionRef>>;
}[];

export const BRANDING_SURFACE_MAP_COUNT = BRANDING_SURFACE_MAP_REGISTRY.length;
