import { WIDGET_ENTITLEMENT_MAP } from "./widgetEntitlementMap";
import type { WidgetEntitlementMapKey } from "./widgetEntitlementMap";
import type { EntitlementKey } from "../types";

/**
 * widgetId → entitlement key
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveWidgetEntitlementKey(widgetId: WidgetEntitlementMapKey): EntitlementKey | null {
  return WIDGET_ENTITLEMENT_MAP[widgetId] ?? null;
}
