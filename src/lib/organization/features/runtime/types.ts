import type { OrganizationFeatures } from "../types";

export type OrganizationFeaturesRuntimeSnapshot = {
  features: OrganizationFeatures;
  featuresRevision: number;
};

export type OrganizationFeaturesRuntimeSource =
  | "kill_switch"
  | "request_cache"
  | "process_cache"
  | "database"
  | "repository_error_fallback";

export type OrganizationFeaturesRuntimeResult = OrganizationFeaturesRuntimeSnapshot & {
  source: OrganizationFeaturesRuntimeSource;
};

export type GetOrganizationFeaturesOptions = {
  /** Test ve ileri fazlar — production'da admin client kullanilir. */
  persistencePort?: import("../persistence/types").OrganizationFeaturesPersistencePort;
};
