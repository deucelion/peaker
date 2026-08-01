import {
  ACTION_NAMESPACE_ENTITLEMENT_MAP,
  ACTION_NAMESPACE_IDS,
} from "./actionNamespaceMap";
import type { EntitlementKey } from "../types";

const ACTION_NAMESPACE_PREFIX_TO_ENTITLEMENT = Object.fromEntries(
  Object.entries(ACTION_NAMESPACE_IDS).map(([prefix, mapKey]) => [
    prefix,
    ACTION_NAMESPACE_ENTITLEMENT_MAP[mapKey],
  ])
) as Record<string, EntitlementKey>;

/**
 * withServerActionGuard action adindan (namespace prefix) entitlement cozer.
 * Map miss → null.
 */
export function resolveActionNamespaceEntitlementKey(actionName: string): EntitlementKey | null {
  const dotIndex = actionName.indexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const namespacePrefix = actionName.slice(0, dotIndex);
  return ACTION_NAMESPACE_PREFIX_TO_ENTITLEMENT[namespacePrefix] ?? null;
}
