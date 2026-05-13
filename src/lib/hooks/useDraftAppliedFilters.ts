"use client";

import { useCallback, useState } from "react";

/**
 * Faz 8.5-8.6 — Generic draft/applied filter slice.
 *
 * Hedef:
 *   - Performans, muhasebe-finans gibi dashboard'larda tekrarlanan
 *     "draftX vs appliedX" çift state pattern'ini standardize etmek.
 *   - `apply()` ile draft → applied; `reset()` ile her ikisi initial'a.
 *   - Page component'leri sadece UI'a odaklanır.
 *
 * Davranış parity:
 *   Mevcut sayfalar bu hook'a kademeli geçebilir; tek seferde değişiklik
 *   zorunlu değildir.
 */

export function useDraftAppliedFilters<T extends Record<string, unknown>>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const [applied, setApplied] = useState<T>(initial);

  const apply = useCallback(() => {
    setApplied(draft);
  }, [draft]);

  const reset = useCallback(() => {
    setDraft(initial);
    setApplied(initial);
  }, [initial]);

  const setDraftField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setBoth = useCallback((value: T) => {
    setDraft(value);
    setApplied(value);
  }, []);

  return {
    draft,
    applied,
    setDraft,
    setApplied,
    setDraftField,
    setBoth,
    apply,
    reset,
  };
}
