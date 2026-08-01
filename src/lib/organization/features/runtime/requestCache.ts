import { AsyncLocalStorage } from "node:async_hooks";
import type { OrganizationFeaturesRuntimeSnapshot } from "./types";

const requestCacheStorage = new AsyncLocalStorage<Map<string, OrganizationFeaturesRuntimeSnapshot>>();

export function runWithOrganizationFeaturesRequestCache<T>(fn: () => T): T {
  return requestCacheStorage.run(new Map(), fn);
}

export async function runWithOrganizationFeaturesRequestCacheAsync<T>(fn: () => Promise<T>): Promise<T> {
  return requestCacheStorage.run(new Map(), fn);
}

export function readOrganizationFeaturesRequestCache(
  organizationId: string
): OrganizationFeaturesRuntimeSnapshot | null {
  const store = requestCacheStorage.getStore();
  if (!store) {
    return null;
  }
  return store.get(organizationId) ?? null;
}

export function writeOrganizationFeaturesRequestCache(
  organizationId: string,
  snapshot: OrganizationFeaturesRuntimeSnapshot
): void {
  const store = requestCacheStorage.getStore();
  if (!store) {
    return;
  }
  store.set(organizationId, snapshot);
}
