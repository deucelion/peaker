"use client";

import { useCallback, useRef, useState } from "react";
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
  type FormDraftId,
} from "@/lib/offline/formDrafts";

function mergeDraft<T extends Record<string, unknown>>(
  scopeKey: string,
  formId: FormDraftId,
  initial: T,
  deserialize: (payload: Record<string, unknown>, initial: T) => T
): { values: T; hasDraft: boolean } {
  if (!scopeKey) return { values: initial, hasDraft: false };
  const draft = loadFormDraft(scopeKey, formId);
  if (draft?.payload) {
    return { values: deserialize(draft.payload, initial), hasDraft: true };
  }
  return { values: initial, hasDraft: false };
}

export function useFormDraft<T extends Record<string, unknown>>(options: {
  scopeKey: string;
  formId: FormDraftId;
  initial: T;
  debounceMs?: number;
  serialize?: (values: T) => Record<string, unknown>;
  deserialize?: (payload: Record<string, unknown>, initial: T) => T;
}) {
  const {
    scopeKey,
    formId,
    initial,
    debounceMs = 600,
    serialize = (v) => v as Record<string, unknown>,
    deserialize = (p, init) => ({ ...init, ...(p as T) }),
  } = options;
  const scopeRef = useRef(scopeKey);
  const merged = mergeDraft(scopeKey, formId, initial, deserialize);
  const [values, setValues] = useState<T>(merged.values);
  const [hasDraft, setHasDraft] = useState(merged.hasDraft);
  const [restored, setRestored] = useState(Boolean(scopeKey));

  if (scopeRef.current !== scopeKey) {
    scopeRef.current = scopeKey;
    const next = mergeDraft(scopeKey, formId, initial, deserialize);
    setValues(next.values);
    setHasDraft(next.hasDraft);
    setRestored(Boolean(scopeKey));
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: T) => {
      if (!scopeKey) return;
      saveFormDraft(scopeKey, formId, serialize(next));
      setHasDraft(true);
    },
    [scopeKey, formId, serialize]
  );

  const setValue = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setValues((prev) => {
        const next = typeof patch === "function" ? (patch as (p: T) => T)(prev) : { ...prev, ...patch };
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => persist(next), debounceMs);
        return next;
      });
    },
    [debounceMs, persist]
  );

  const clearDraft = useCallback(() => {
    clearFormDraft(scopeKey, formId);
    setHasDraft(false);
  }, [scopeKey, formId]);

  return { values, setValues, setValue, restored, hasDraft, clearDraft, persist };
}
