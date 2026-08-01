export type { SurfaceEntitlementMap } from "./types";

export {
  assertSurfaceMapContract,
  assertUniqueSurfaceMapKeys,
  collectSurfaceMapContractIssues,
} from "./contractValidation";
export type { SurfaceMapContractIssue } from "./contractValidation";

export {
  ROUTE_DYNAMIC_ENTITLEMENT_MAP,
  ROUTE_DYNAMIC_PATTERN_KEYS,
  ROUTE_DYNAMIC_PATTERN_PATHS,
  ROUTE_ENTITLEMENT_MAP,
} from "./routeEntitlementMap";
export { resolveRouteEntitlementKey } from "./resolveRouteEntitlement";
export { resolveActionNamespaceEntitlementKey } from "./resolveActionNamespaceEntitlement";
export type { RouteDynamicPatternKey } from "./routeEntitlementMap";

export { NAVIGATION_ENTITLEMENT_MAP, NAV_ITEM_IDS } from "./navigationEntitlementMap";
export type { NavigationEntitlementMapKey } from "./navigationEntitlementMap";
export { resolveNavigationEntitlementKey } from "./resolveNavigationEntitlement";

export { QUICK_ACTION_ENTITLEMENT_MAP, QUICK_ACTION_IDS } from "./quickActionEntitlementMap";
export type { QuickActionEntitlementMapKey } from "./quickActionEntitlementMap";

export { EXPORT_ENTITLEMENT_MAP, EXPORT_ENDPOINT_IDS } from "./exportEntitlementMap";
export type { ExportEntitlementMapKey } from "./exportEntitlementMap";
export { resolveExportEntitlementKey } from "./resolveExportEntitlement";
export type { ExportEntitlementMapKey } from "./exportEntitlementMap";

export { OFFLINE_ENTITLEMENT_MAP, OFFLINE_KIND_IDS } from "./offlineEntitlementMap";
export type { OfflineEntitlementMapKey } from "./offlineEntitlementMap";
export { resolveOfflineEntitlementKey } from "./resolveOfflineEntitlement";

export { REALTIME_ENTITLEMENT_MAP, REALTIME_SUBSCRIPTION_IDS } from "./realtimeEntitlementMap";
export type { RealtimeEntitlementMapKey } from "./realtimeEntitlementMap";
export { resolveRealtimeEntitlementKey } from "./resolveRealtimeEntitlement";

export { SNAPSHOT_BRANCH_IDS, SNAPSHOT_ENTITLEMENT_MAP } from "./snapshotEntitlementMap";
export type { SnapshotEntitlementMapKey } from "./snapshotEntitlementMap";
export { resolveSnapshotEntitlementKey } from "./resolveSnapshotEntitlement";
export type { SnapshotEntitlementMapKey } from "./snapshotEntitlementMap";

export { DASHBOARD_WIDGET_IDS, WIDGET_ENTITLEMENT_MAP } from "./widgetEntitlementMap";
export type { WidgetEntitlementMapKey } from "./widgetEntitlementMap";
export { resolveWidgetEntitlementKey } from "./resolveWidgetEntitlement";
export type { WidgetEntitlementMapKey } from "./widgetEntitlementMap";

export { ACTION_NAMESPACE_ENTITLEMENT_MAP, ACTION_NAMESPACE_IDS } from "./actionNamespaceMap";
export type { ActionNamespaceMapKey } from "./actionNamespaceMap";
