export type OrganizationBrandingCacheLayer = "request" | "process";

export type OrganizationBrandingRuntimeMetricEvent =
  | { type: "branding_database" }
  | { type: "branding_request_cache" }
  | { type: "branding_process_cache" }
  | { type: "branding_kill_switch" }
  | { type: "branding_revision_invalidate" }
  | { type: "branding_parse_fallback" }
  | { type: "branding_repository_fallback" }
  | { type: "branding_cache_miss" }
  | { type: "branding_ttl_expiry" };

export type OrganizationBrandingRuntimeMetricsListener = (
  event: OrganizationBrandingRuntimeMetricEvent
) => void;

const listeners = new Set<OrganizationBrandingRuntimeMetricsListener>();

export function subscribeOrganizationBrandingRuntimeMetrics(
  listener: OrganizationBrandingRuntimeMetricsListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitOrganizationBrandingRuntimeMetric(event: OrganizationBrandingRuntimeMetricEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function resetOrganizationBrandingRuntimeMetricsForTests(): void {
  listeners.clear();
}
