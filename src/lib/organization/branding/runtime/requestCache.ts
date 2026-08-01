import { AsyncLocalStorage } from "node:async_hooks";
import type { OrganizationBrandingRuntimeSnapshot } from "./types";

const requestCacheStorage = new AsyncLocalStorage<Map<string, OrganizationBrandingRuntimeSnapshot>>();

export function runWithOrganizationBrandingRequestCache<T>(fn: () => T): T {
  return requestCacheStorage.run(new Map(), fn);
}

export async function runWithOrganizationBrandingRequestCacheAsync<T>(fn: () => Promise<T>): Promise<T> {
  return requestCacheStorage.run(new Map(), fn);
}

export function readOrganizationBrandingRequestCache(
  organizationId: string
): OrganizationBrandingRuntimeSnapshot | null {
  const store = requestCacheStorage.getStore();
  if (!store) {
    return null;
  }
  return store.get(organizationId) ?? null;
}

export function writeOrganizationBrandingRequestCache(
  organizationId: string,
  snapshot: OrganizationBrandingRuntimeSnapshot
): void {
  const store = requestCacheStorage.getStore();
  if (!store) {
    return;
  }
  store.set(organizationId, snapshot);
}
