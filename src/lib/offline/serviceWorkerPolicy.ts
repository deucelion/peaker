/**
 * Service worker cache policy — pure functions (testable).
 * Dashboard HTML, API, auth ve tenant verisi cache'lenmez.
 */

const NEVER_CACHE_PREFIXES = ["/api/", "/auth/"];

const NEVER_CACHE_EXACT = new Set(["/manifest.webmanifest"]);

export function shouldNeverCacheRequest(input: {
  pathname: string;
  method: string;
  hostname: string;
  origin: string;
  appOrigin: string;
}): boolean {
  if (input.method !== "GET") return true;
  if (input.hostname !== new URL(input.appOrigin).hostname) {
    if (input.hostname.includes("supabase")) return true;
    return true;
  }
  const path = input.pathname;
  if (NEVER_CACHE_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (path.includes("/exports/")) return true;
  if (path.endsWith(".csv")) return true;
  if (path.includes("realtime")) return true;
  if (path.startsWith("/_next/data/")) return true;
  return false;
}

export function isStaticAssetCacheable(pathname: string): boolean {
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/offline") return true;
  if (NEVER_CACHE_EXACT.has(pathname)) return true;
  return false;
}

export function isNavigationRequest(mode: string | undefined): boolean {
  return mode === "navigate";
}

export const STATIC_CACHE_NAME = "peaker-static-v2";

export const PRECACHE_URLS = ["/offline", "/icons/icon.svg", "/icons/icon-maskable.svg"] as const;
