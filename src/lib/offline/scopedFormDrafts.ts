"use client";

const LS_PREFIX = "peaker_scoped_draft_v1:";
const IDB_DB = "peaker_form_drafts_v1";
const IDB_STORE = "form_drafts";

export type ScopedFormDraftRecord = {
  key: string;
  scopeKey: string;
  draftKey: string;
  payload: Record<string, unknown>;
  updatedAt: string;
};

function lsKey(scopeKey: string, draftKey: string) {
  return `${LS_PREFIX}${scopeKey}:${draftKey}`;
}

function storageKey(scopeKey: string, draftKey: string) {
  return `${scopeKey}::scoped::${draftKey}`;
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no_idb"));
      return;
    }
    const req = indexedDB.open(IDB_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "key" });
      }
    };
  });
}

export function saveScopedFormDraft(
  scopeKey: string,
  draftKey: string,
  payload: Record<string, unknown>
): void {
  const record: ScopedFormDraftRecord = {
    key: storageKey(scopeKey, draftKey),
    scopeKey,
    draftKey,
    payload,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(lsKey(scopeKey, draftKey), JSON.stringify(record));
  } catch {
    /* quota */
  }
  void (async () => {
    try {
      const db = await openDraftDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(record);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* optional */
    }
  })();
  if (typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(
      new CustomEvent("peaker-scoped-draft-changed", { detail: { scopeKey, draftKey } })
    );
  }
}

export function loadScopedFormDraft(scopeKey: string, draftKey: string): ScopedFormDraftRecord | null {
  try {
    const raw = localStorage.getItem(lsKey(scopeKey, draftKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScopedFormDraftRecord;
    if (parsed.scopeKey !== scopeKey || parsed.draftKey !== draftKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearScopedFormDraft(scopeKey: string, draftKey: string): void {
  try {
    localStorage.removeItem(lsKey(scopeKey, draftKey));
  } catch {
    /* ignore */
  }
  void (async () => {
    try {
      const db = await openDraftDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(storageKey(scopeKey, draftKey));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* ignore */
    }
  })();
}
