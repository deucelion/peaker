"use client";

import { useCallback, useRef, useState } from "react";
import {
  clearScopedFormDraft,
  loadScopedFormDraft,
  saveScopedFormDraft,
} from "@/lib/offline/scopedFormDrafts";

function mergeDraft<T extends Record<string, unknown>>(
  scopeKey: string,
  draftKey: string,
  initial: T,
  deserialize: (payload: Record<string, unknown>, initial: T) => T
): { values: T; hasDraft: boolean } {
  if (!scopeKey || !draftKey) return { values: initial, hasDraft: false };
  const draft = loadScopedFormDraft(scopeKey, draftKey);
  if (draft?.payload) {
    return { values: deserialize(draft.payload, initial), hasDraft: true };
  }
  return { values: initial, hasDraft: false };
}

export function useScopedFormDraft<T extends Record<string, unknown>>(options: {
  scopeKey: string;
  draftKey: string;
  initial: T;
  debounceMs?: number;
  serialize?: (values: T) => Record<string, unknown>;
  deserialize?: (payload: Record<string, unknown>, initial: T) => T;
  enabled?: boolean;
}) {
  const {
    scopeKey,
    draftKey,
    initial,
    debounceMs = 600,
    serialize = (v) => v as Record<string, unknown>,
    deserialize = (p, init) => ({ ...init, ...(p as T) }),
    enabled = true,
  } = options;

  const scopeRef = useRef(scopeKey);
  const keyRef = useRef(draftKey);
  const merged = enabled ? mergeDraft(scopeKey, draftKey, initial, deserialize) : { values: initial, hasDraft: false };
  const [values, setValues] = useState<T>(merged.values);
  const [hasDraft, setHasDraft] = useState(merged.hasDraft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (enabled && (scopeRef.current !== scopeKey || keyRef.current !== draftKey)) {
    scopeRef.current = scopeKey;
    keyRef.current = draftKey;
    const next = mergeDraft(scopeKey, draftKey, initial, deserialize);
    setValues(next.values);
    setHasDraft(next.hasDraft);
  }

  const persist = useCallback(
    (next: T) => {
      if (!enabled || !scopeKey || !draftKey) return;
      saveScopedFormDraft(scopeKey, draftKey, serialize(next));
      setHasDraft(true);
    },
    [scopeKey, draftKey, enabled, serialize]
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
    if (scopeKey && draftKey) clearScopedFormDraft(scopeKey, draftKey);
    setHasDraft(false);
  }, [scopeKey, draftKey]);

  return { values, setValues, setValue, hasDraft, clearDraft, persist };
}
