import type { BrandingCanonicalSectionRef } from "./types";
import { BRANDING_CANONICAL_SECTION_REF_LIST } from "./types";

const CANONICAL_SECTION_REF_SET = new Set<string>(BRANDING_CANONICAL_SECTION_REF_LIST);

export type SurfaceBrandingMapContractIssue =
  | { type: "unknown_section"; mapName: string; key: string; section: string }
  | { type: "duplicate_key"; mapName: string; key: string }
  | { type: "duplicate_surface_id"; surfaceId: string; maps: readonly string[] };

export function isCanonicalBrandingSectionRef(section: string): section is BrandingCanonicalSectionRef {
  return CANONICAL_SECTION_REF_SET.has(section);
}

export function collectSurfaceBrandingMapContractIssues(
  mapName: string,
  map: Readonly<Record<string, BrandingCanonicalSectionRef>>
): SurfaceBrandingMapContractIssue[] {
  const issues: SurfaceBrandingMapContractIssue[] = [];
  const seenKeys = new Set<string>();

  for (const [key, section] of Object.entries(map)) {
    if (seenKeys.has(key)) {
      issues.push({ type: "duplicate_key", mapName, key });
    }
    seenKeys.add(key);

    if (!isCanonicalBrandingSectionRef(section)) {
      issues.push({ type: "unknown_section", mapName, key, section });
    }
  }

  return issues;
}

export function assertSurfaceBrandingMapContract(
  mapName: string,
  map: Readonly<Record<string, BrandingCanonicalSectionRef>>
): void {
  const issues = collectSurfaceBrandingMapContractIssues(mapName, map);
  if (issues.length === 0) {
    return;
  }

  const summary = issues
    .map((issue) => {
      if (issue.type === "unknown_section") {
        return `${issue.key}: unknown branding section "${issue.section}"`;
      }
      if (issue.type === "duplicate_surface_id") {
        return `${issue.surfaceId}: registered in ${issue.maps.join(", ")}`;
      }
      return `${issue.key}: duplicate registration`;
    })
    .join("; ");

  throw new Error(`${mapName} contract violation — ${summary}`);
}

export function assertUniqueSurfaceBrandingMapKeys(mapName: string, keys: readonly string[]): void {
  const unique = new Set(keys);
  if (unique.size === keys.length) {
    return;
  }

  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  throw new Error(`${mapName} duplicate keys — ${[...new Set(duplicates)].join(", ")}`);
}

export function collectDuplicateSurfaceIdIssues(
  entries: readonly { mapName: string; map: Readonly<Record<string, BrandingCanonicalSectionRef>> }[]
): SurfaceBrandingMapContractIssue[] {
  const surfaceOwners = new Map<string, string[]>();

  for (const { mapName, map } of entries) {
    for (const surfaceId of Object.keys(map)) {
      const owners = surfaceOwners.get(surfaceId) ?? [];
      owners.push(mapName);
      surfaceOwners.set(surfaceId, owners);
    }
  }

  const issues: SurfaceBrandingMapContractIssue[] = [];
  for (const [surfaceId, maps] of surfaceOwners.entries()) {
    if (maps.length > 1) {
      issues.push({ type: "duplicate_surface_id", surfaceId, maps });
    }
  }

  return issues;
}

export function assertNoDuplicateSurfaceIds(
  entries: readonly { mapName: string; map: Readonly<Record<string, BrandingCanonicalSectionRef>> }[]
): void {
  const issues = collectDuplicateSurfaceIdIssues(entries);
  if (issues.length === 0) {
    return;
  }

  const summary = issues
    .map((issue) => {
      if (issue.type === "duplicate_surface_id") {
        return `${issue.surfaceId}: ${issue.maps.join(", ")}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("; ");

  throw new Error(`Duplicate surface id registration — ${summary}`);
}

export function assertBrandingSurfaceMapCompleteness(
  entries: readonly { mapName: string; map: Readonly<Record<string, BrandingCanonicalSectionRef>> }[],
  requiredSurfaceCount: number
): void {
  const allSurfaceIds = entries.flatMap(({ map }) => Object.keys(map));
  if (allSurfaceIds.length !== requiredSurfaceCount) {
    throw new Error(
      `Branding surface map completeness violation — expected ${requiredSurfaceCount} surfaces, found ${allSurfaceIds.length}`
    );
  }
}
