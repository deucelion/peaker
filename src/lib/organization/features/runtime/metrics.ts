export type OrganizationFeaturesCacheLayer = "request" | "process";

export type OrganizationFeaturesRuntimeMetricEvent =
  | { type: "cache_hit"; layer: OrganizationFeaturesCacheLayer }
  | { type: "cache_miss" }
  | { type: "kill_switch_fallback" }
  | { type: "parse_fallback" }
  | { type: "revision_invalidate" }
  | { type: "repository_error_fallback" }
  | { type: "ttl_expiry" }
  | { type: "feature_route_allowed" }
  | { type: "feature_route_denied" }
  | { type: "feature_action_allowed" }
  | { type: "feature_action_denied" }
  | { type: "feature_action_map_miss" };

export type OrganizationFeaturesRuntimeMetricsListener = (
  event: OrganizationFeaturesRuntimeMetricEvent
) => void;

const listeners = new Set<OrganizationFeaturesRuntimeMetricsListener>();

export function subscribeOrganizationFeaturesRuntimeMetrics(
  listener: OrganizationFeaturesRuntimeMetricsListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitOrganizationFeaturesRuntimeMetric(event: OrganizationFeaturesRuntimeMetricEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function resetOrganizationFeaturesRuntimeMetricsForTests(): void {
  listeners.clear();
}
