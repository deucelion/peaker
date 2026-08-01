import {
  isAthleteManagementProfilePath,
  isPrivateLessonPackageDetailPath,
  matchesPathPrefix,
  normalizePathname,
  PATHS,
} from "@/lib/navigation/routeRegistry";
import type { EntitlementKey } from "../types";
import {
  ROUTE_DYNAMIC_ENTITLEMENT_MAP,
  ROUTE_DYNAMIC_PATTERN_KEYS,
  ROUTE_ENTITLEMENT_MAP,
} from "./routeEntitlementMap";

const ROUTE_ENTITLEMENT_PREFIX_BASES = Object.keys(ROUTE_ENTITLEMENT_MAP)
  .filter((base) => base !== PATHS.home)
  .sort((a, b) => b.length - a.length);

function resolveExactRouteEntitlementKey(normalizedPathname: string): EntitlementKey | null {
  const exact = ROUTE_ENTITLEMENT_MAP[normalizedPathname as keyof typeof ROUTE_ENTITLEMENT_MAP];
  return exact ?? null;
}

function resolveDynamicRouteEntitlementKey(normalizedPathname: string): EntitlementKey | null {
  if (isAthleteManagementProfilePath(normalizedPathname)) {
    return ROUTE_DYNAMIC_ENTITLEMENT_MAP[ROUTE_DYNAMIC_PATTERN_KEYS.athleteManagementProfile];
  }
  if (isPrivateLessonPackageDetailPath(normalizedPathname)) {
    return ROUTE_DYNAMIC_ENTITLEMENT_MAP[ROUTE_DYNAMIC_PATTERN_KEYS.privateLessonPackageDetail];
  }
  return null;
}

function resolvePrefixRouteEntitlementKey(normalizedPathname: string): EntitlementKey | null {
  for (const base of ROUTE_ENTITLEMENT_PREFIX_BASES) {
    if (matchesPathPrefix(normalizedPathname, base)) {
      return ROUTE_ENTITLEMENT_MAP[base as keyof typeof ROUTE_ENTITLEMENT_MAP];
    }
  }
  return null;
}

/**
 * pathname → entitlement key
 * 1) static route map (exact)
 * 2) dynamic route map
 * 3) static route map (longest prefix)
 * Map miss → null (feature kontrolu yapilmaz).
 */
export function resolveRouteEntitlementKey(pathname: string): EntitlementKey | null {
  const normalizedPathname = normalizePathname(pathname);

  const exact = resolveExactRouteEntitlementKey(normalizedPathname);
  if (exact) {
    return exact;
  }

  const dynamic = resolveDynamicRouteEntitlementKey(normalizedPathname);
  if (dynamic) {
    return dynamic;
  }

  return resolvePrefixRouteEntitlementKey(normalizedPathname);
}
