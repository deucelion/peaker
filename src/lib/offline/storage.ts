import type { OfflineQueuedAction } from "@/lib/offline/types";

const STORAGE_KEY = "peaker_offline_queue_v1";

function getStorage(): Storage | null {
  if (typeof globalThis === "undefined") return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readOfflineQueue(): OfflineQueuedAction[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOfflineActionShape) as OfflineQueuedAction[];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(items: OfflineQueuedAction[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(new CustomEvent("peaker-offline-queue-changed"));
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearOfflineStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(new CustomEvent("peaker-offline-queue-changed"));
    }
  } catch {
    /* ignore */
  }
}

function isOfflineActionShape(value: unknown): value is OfflineQueuedAction {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.kind === "string" &&
    typeof row.scopeKey === "string" &&
    typeof row.createdAt === "string"
  );
}
