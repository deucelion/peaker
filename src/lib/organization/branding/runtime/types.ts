export type OrganizationBrandingRuntimeSnapshot = {
  branding: import("../types").OrganizationBranding;
  brandingRevision: number;
};

export type OrganizationBrandingRuntimeSource =
  | "kill_switch"
  | "request_cache"
  | "process_cache"
  | "database"
  | "repository_error_fallback"
  | "parse_fallback";

export type OrganizationBrandingRuntimeResult = OrganizationBrandingRuntimeSnapshot & {
  source: OrganizationBrandingRuntimeSource;
};

export type GetOrganizationBrandingRuntimeOptions = {
  /** Test ve ileri fazlar — production'da admin client kullanilir. */
  persistencePort?: import("../persistence/types").OrganizationBrandingPersistencePort;
};
