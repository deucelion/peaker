"use client";

import type { OfflineQueuedAction } from "@/lib/offline/types";
import { readOfflineQueue, writeOfflineQueue } from "@/lib/offline/storage";
import { localStorageQueueAdapter } from "@/lib/offline/queueStorage/localStorageAdapter";
import {
  getIndexedDbMigrationFlag,
  indexedDbQueueAdapter,
  isIndexedDbQueueAvailable,
  setIndexedDbMigrationFlag,
} from "@/lib/offline/queueStorage/indexedDbAdapter";

let memoryQueue: OfflineQueuedAction[] | null = null;
let hydratePromise: Promise<void> | null = null;
let lastScopeKey: string | null = null;

function dispatchQueueChanged() {
  if (typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("peaker-offline-queue-changed"));
  }
}

export function getOfflineQueueSnapshot(): OfflineQueuedAction[] {
  if (memoryQueue) return [...memoryQueue];
  return readOfflineQueue();
}

export async function hydrateOfflineQueue(expectedScopeKey?: string): Promise<void> {
  if (hydratePromise) {
    await hydratePromise;
    if (expectedScopeKey && lastScopeKey && lastScopeKey !== expectedScopeKey) {
      await reloadQueueForScope(expectedScopeKey);
    }
    return;
  }

  hydratePromise = (async () => {
    const legacy = await localStorageQueueAdapter.readAll();
    const idbOk = await isIndexedDbQueueAvailable();
    let items: OfflineQueuedAction[] = [];

    if (idbOk) {
      const migrated = await getIndexedDbMigrationFlag();
      const idbItems = await indexedDbQueueAdapter.readAll();
      if (!migrated && legacy.length > 0) {
        items = legacy;
        await indexedDbQueueAdapter.writeAll(legacy);
        await setIndexedDbMigrationFlag();
      } else if (idbItems.length > 0) {
        items = idbItems;
      } else if (legacy.length > 0) {
        items = legacy;
        await indexedDbQueueAdapter.writeAll(legacy);
      }
    } else {
      items = legacy;
    }

    memoryQueue = items;
    writeOfflineQueue(items);
    if (expectedScopeKey) lastScopeKey = expectedScopeKey;
  })();

  await hydratePromise;
}

async function reloadQueueForScope(scopeKey: string): Promise<void> {
  hydratePromise = null;
  lastScopeKey = scopeKey;
  await hydrateOfflineQueue(scopeKey);
}

export async function persistOfflineQueue(items: OfflineQueuedAction[]): Promise<void> {
  memoryQueue = [...items];
  writeOfflineQueue(items);
  try {
    if (await isIndexedDbQueueAvailable()) {
      await indexedDbQueueAdapter.writeAll(items);
    }
  } catch {
    /* quota — localStorage backup remains */
  }
  dispatchQueueChanged();
}

export async function clearOfflineQueueAll(): Promise<void> {
  memoryQueue = [];
  writeOfflineQueue([]);
  await localStorageQueueAdapter.clear();
  try {
    if (await isIndexedDbQueueAvailable()) {
      await indexedDbQueueAdapter.clear();
    }
  } catch {
    /* ignore */
  }
  dispatchQueueChanged();
}

export async function purgeOtherScopes(activeScopeKey: string): Promise<void> {
  const items = getOfflineQueueSnapshot().filter((item) => item.scopeKey === activeScopeKey);
  await persistOfflineQueue(items);
  lastScopeKey = activeScopeKey;
}

export function resetOfflineQueueForTests(): void {
  memoryQueue = null;
  hydratePromise = null;
  lastScopeKey = null;
}
