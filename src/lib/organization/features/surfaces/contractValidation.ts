import { MODULE_CATALOG } from "../catalog";
import { isCanonicalEntitlementKey } from "../keys";
import type { EntitlementKey } from "../types";

const CATALOG_KEY_SET = new Set(MODULE_CATALOG.map((entry) => entry.key));

export type SurfaceMapContractIssue =
  | { type: "unknown_entitlement"; mapName: string; key: string; entitlement: string }
  | { type: "missing_catalog_key"; mapName: string; key: string; entitlement: EntitlementKey }
  | { type: "duplicate_key"; mapName: string; key: string };

export function collectSurfaceMapContractIssues(
  mapName: string,
  map: Readonly<Record<string, EntitlementKey>>
): SurfaceMapContractIssue[] {
  const issues: SurfaceMapContractIssue[] = [];
  const seenKeys = new Set<string>();

  for (const [key, entitlement] of Object.entries(map)) {
    if (seenKeys.has(key)) {
      issues.push({ type: "duplicate_key", mapName, key });
    }
    seenKeys.add(key);

    if (!isCanonicalEntitlementKey(entitlement)) {
      issues.push({ type: "unknown_entitlement", mapName, key, entitlement });
      continue;
    }

    if (!CATALOG_KEY_SET.has(entitlement)) {
      issues.push({ type: "missing_catalog_key", mapName, key, entitlement });
    }
  }

  return issues;
}

export function assertSurfaceMapContract(mapName: string, map: Readonly<Record<string, EntitlementKey>>): void {
  const issues = collectSurfaceMapContractIssues(mapName, map);
  if (issues.length === 0) {
    return;
  }

  const summary = issues
    .map((issue) => {
      if (issue.type === "unknown_entitlement") {
        return `${issue.key}: unknown entitlement "${issue.entitlement}"`;
      }
      if (issue.type === "missing_catalog_key") {
        return `${issue.key}: entitlement "${issue.entitlement}" missing from catalog`;
      }
      return `${issue.key}: duplicate registration`;
    })
    .join("; ");

  throw new Error(`${mapName} contract violation — ${summary}`);
}

export function assertUniqueSurfaceMapKeys(mapName: string, keys: readonly string[]): void {
  const unique = new Set(keys);
  if (unique.size === keys.length) {
    return;
  }

  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  throw new Error(`${mapName} duplicate keys — ${[...new Set(duplicates)].join(", ")}`);
}
