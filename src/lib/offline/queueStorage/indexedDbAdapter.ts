import type { OfflineQueueStorage } from "@/lib/offline/queueStorage/types";
import type { OfflineQueuedAction } from "@/lib/offline/types";

const DB_NAME = "peaker_offline_v1";
const STORE = "action_queue";
const META_STORE = "meta";
const MIGRATION_KEY = "ls_migrated_v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB_unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
  });
}

function sanitizeAction(raw: unknown): OfflineQueuedAction | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.kind !== "string" ||
    typeof row.scopeKey !== "string" ||
    typeof row.createdAt !== "string"
  ) {
    return null;
  }
  if (!row.payload || typeof row.payload !== "object") return null;
  return row as OfflineQueuedAction;
}

export const indexedDbQueueAdapter: OfflineQueueStorage = {
  name: "indexedDB",
  async readAll() {
    try {
      const db = await openDb();
      return new Promise<OfflineQueuedAction[]>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          const rows = (req.result as unknown[])
            .map(sanitizeAction)
            .filter((r): r is OfflineQueuedAction => r !== null);
          resolve(rows);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return [];
    }
  },
  async writeAll(items: OfflineQueuedAction[]) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  },
  async clear() {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, META_STORE], "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  },
};

export async function isIndexedDbQueueAvailable(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

export async function getIndexedDbMigrationFlag(): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).get(MIGRATION_KEY);
      req.onsuccess = () => {
        resolve(Boolean(req.result));
        db.close();
      };
      req.onerror = () => {
        resolve(false);
        db.close();
      };
    });
  } catch {
    return false;
  }
}

export async function setIndexedDbMigrationFlag(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put(true, MIGRATION_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
