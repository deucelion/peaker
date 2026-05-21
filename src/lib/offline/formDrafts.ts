"use client";

const LS_PREFIX = "peaker_form_draft_v1:";
const IDB_DB = "peaker_form_drafts_v1";
const IDB_STORE = "form_drafts";

export type FormDraftId =
  | "wellness_morning"
  | "rpe_survey"
  | "field_test_note"
  | "coach_athlete_note"
  | "attendance_batch";

export type FormDraftRecord = {
  scopeKey: string;
  formId: FormDraftId;
  payload: Record<string, unknown>;
  updatedAt: string;
};

function lsKey(scopeKey: string, formId: FormDraftId) {
  return `${LS_PREFIX}${scopeKey}:${formId}`;
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

function draftKey(scopeKey: string, formId: FormDraftId) {
  return `${scopeKey}::${formId}`;
}

export function saveFormDraft(scopeKey: string, formId: FormDraftId, payload: Record<string, unknown>): void {
  const record: FormDraftRecord & { key: string } = {
    key: draftKey(scopeKey, formId),
    scopeKey,
    formId,
    payload,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(lsKey(scopeKey, formId), JSON.stringify(record));
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
      /* idb optional */
    }
  })();
  if (typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("peaker-form-draft-changed", { detail: { scopeKey, formId } }));
  }
}

export function loadFormDraft(scopeKey: string, formId: FormDraftId): FormDraftRecord | null {
  try {
    const raw = localStorage.getItem(lsKey(scopeKey, formId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraftRecord;
    if (parsed.scopeKey !== scopeKey || parsed.formId !== formId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearFormDraft(scopeKey: string, formId: FormDraftId): void {
  try {
    localStorage.removeItem(lsKey(scopeKey, formId));
  } catch {
    /* ignore */
  }
  void (async () => {
    try {
      const db = await openDraftDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(draftKey(scopeKey, formId));
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

export function clearAllFormDraftsForScope(scopeKey: string): void {
  const ids: FormDraftId[] = [
    "wellness_morning",
    "rpe_survey",
    "field_test_note",
    "coach_athlete_note",
    "attendance_batch",
  ];
  for (const formId of ids) {
    clearFormDraft(scopeKey, formId);
  }
}
