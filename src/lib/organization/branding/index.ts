export type {
  BrandingApplication,
  BrandingAssetKind,
  BrandingAssetReference,
  BrandingAssets,
  BrandingColorTokenKey,
  BrandingEmail,
  BrandingPdf,
  BrandingSidebar,
  BrandingTextTokenKey,
  BrandingTheme,
  OrganizationBranding,
  ParseBrandingFailureReason,
  ParseOrganizationBrandingResult,
  ValidateBrandingResult,
} from "./types";

export {
  BRANDING_ASSET_KIND_LIST,
  BRANDING_ASSET_KINDS,
  BRANDING_ASSET_TOKEN_KEYS,
  BRANDING_CANONICAL_TOKEN_KEYS,
  BRANDING_COLOR_TOKEN_KEY_LIST,
  BRANDING_COLOR_TOKEN_KEYS,
  BRANDING_SCHEMA_VERSION,
  BRANDING_TEXT_TOKEN_KEY_LIST,
  BRANDING_TEXT_TOKEN_KEYS,
  isBrandingAssetKind,
  isBrandingCanonicalTokenKey,
  isBrandingColorTokenKey,
} from "./tokens";

export { createDefaultBranding } from "./defaults";

export {
  cloneBranding,
  isBrandingEqual,
  mergeBranding,
  mergeBrandingAssetReferences,
  mergeBrandingAssetsFromPartial,
  mergeBrandingSectionFromPartial,
  mergeBrandingThemeFromPartial,
  parseBrandingAssetReference,
} from "./helpers";

export {
  isOrganizationBranding,
  normalizeOrganizationBranding,
  parseOrganizationBranding,
} from "./parser";

export {
  isValidBrandingColor,
  readNonEmptyStringOrUndefined,
  readNonNegativeIntOrUndefined,
  stripUnknownAssetKeys,
  stripUnknownBrandingKeys,
  stripUnknownThemeKeys,
  validateBranding,
  validateBrandingAssetReference,
  validateBrandingAssets,
  validateBrandingTokens,
} from "./validation";

export type {
  GetOrganizationBrandingResult,
  OrganizationBrandingPersistencePort,
  OrganizationBrandingRepositoryError,
  OrganizationBrandingRepositoryErrorCode,
  OrganizationBrandingRuntimeRow,
  SaveOrganizationBrandingInput,
  SaveOrganizationBrandingResult,
} from "./persistence/types";

export {
  DEFAULT_BRANDING,
  createDefaultBrandingJson,
  serializeBranding,
} from "./persistence/constants";

export {
  createSupabaseOrganizationBrandingPersistencePort,
  getOrganizationBranding as readOrganizationBrandingPersistence,
  getOrganizationBrandingFromAdminClient,
  saveOrganizationBranding,
  saveOrganizationBrandingFromAdminClient,
} from "./persistence/organizationBrandingRepository";

export type {
  GetOrganizationBrandingRuntimeOptions,
  OrganizationBrandingRuntimeResult,
  OrganizationBrandingRuntimeSnapshot,
  OrganizationBrandingRuntimeSource,
} from "./runtime/types";

export {
  getOrganizationBranding,
  invalidateOrganizationBrandingRuntimeCache,
  KILL_SWITCH_BRANDING_REVISION,
} from "./runtime/getOrganizationBranding";

export { isOrganizationBrandingRuntimeEnabled } from "./runtime/killSwitch";

export {
  emitOrganizationBrandingRuntimeMetric,
  subscribeOrganizationBrandingRuntimeMetrics,
} from "./runtime/metrics";

export { runWithOrganizationBrandingRequestCacheAsync } from "./runtime/requestCache";

export type { MeAccessOrganizationBrandingPayload } from "./runtime/brandingMeAccessPayload";

export { resolveOrganizationBrandingForMeAccess } from "./runtime/brandingMeAccessPayload";

export type {
  BrandingAssetSectionPath,
  BrandingCanonicalSectionRef,
  BrandingNestedAssetSectionRef,
  BrandingSurfaceKind,
  BrandingTopLevelSectionPath,
  EmailSurfaceId,
  FaviconSurfaceId,
  LayoutSurfaceId,
  LogoSurfaceId,
  MetadataSurfaceId,
  PdfSurfaceId,
  SidebarSurfaceId,
  SurfaceBrandingMap,
  SurfaceBrandingMapContractIssue,
} from "./surfaces";

export { resolveLayoutBranding } from "./surfaces/resolveLayoutBranding";
export type { LayoutBrandingSnapshot } from "./surfaces/resolveLayoutBranding";
export { resolveSidebarBranding } from "./surfaces/resolveSidebarBranding";
export type { SidebarBrandingSnapshot } from "./surfaces/resolveSidebarBranding";
export { resolveLogoBranding } from "./surfaces/resolveLogoBranding";
export type { LogoBrandingSnapshot } from "./surfaces/resolveLogoBranding";
export { resolveMetadataBranding } from "./surfaces/resolveMetadataBranding";
export type { MetadataBrandingSnapshot } from "./surfaces/resolveMetadataBranding";
export { resolveFaviconBranding } from "./surfaces/resolveFaviconBranding";
export type { FaviconBrandingSnapshot } from "./surfaces/resolveFaviconBranding";
export { resolvePdfBranding } from "./surfaces/resolvePdfBranding";
export type { PdfBrandingSnapshot } from "./surfaces/resolvePdfBranding";
export { resolveEmailBranding } from "./surfaces/resolveEmailBranding";
export type { EmailBrandingSnapshot } from "./surfaces/resolveEmailBranding";

export {
  assertBrandingSurfaceMapCompleteness,
  assertNoDuplicateSurfaceIds,
  assertSurfaceBrandingMapContract,
  assertUniqueSurfaceBrandingMapKeys,
  BRANDING_ASSET_SECTION_PATHS,
  BRANDING_CANONICAL_SECTION_REF_LIST,
  BRANDING_CANONICAL_SECTION_REFS,
  BRANDING_SECTION_PATHS,
  BRANDING_SURFACE_KINDS,
  BRANDING_SURFACE_MAP_COUNT,
  BRANDING_SURFACE_MAP_REGISTRY,
  collectDuplicateSurfaceIdIssues,
  collectSurfaceBrandingMapContractIssues,
  EMAIL_BRANDING_MAP,
  EMAIL_SURFACE_IDS,
  FAVICON_BRANDING_MAP,
  FAVICON_SURFACE_IDS,
  isCanonicalBrandingSectionRef,
  LAYOUT_BRANDING_MAP,
  LAYOUT_SURFACE_IDS,
  LOGO_BRANDING_MAP,
  LOGO_SURFACE_IDS,
  METADATA_BRANDING_MAP,
  METADATA_SURFACE_IDS,
  PDF_BRANDING_MAP,
  PDF_SURFACE_IDS,
  SIDEBAR_BRANDING_MAP,
  SIDEBAR_SURFACE_IDS,
} from "./surfaces";
