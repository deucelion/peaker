"use client";

import { useCallback, useEffect } from "react";

const SCROLL_KEY_PREFIX = "peaker.scroll.";

/** Sayfa geri dönüşünde scroll pozisyonunu sessionStorage ile korur. */
export function useScrollRestore(storageKey: string, enabled = true): void {
  const key = `${SCROLL_KEY_PREFIX}${storageKey}`;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(key);
    if (saved) {
      const y = Number(saved);
      if (Number.isFinite(y) && y > 0) {
        window.requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
      }
      window.sessionStorage.removeItem(key);
    }
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const save = () => {
      try {
        window.sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [enabled, key]);
}

export function useSaveScrollBeforeNavigate(storageKey: string): () => void {
  const key = `${SCROLL_KEY_PREFIX}${storageKey}`;
  return useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, String(window.scrollY));
    } catch {
      /* ignore */
    }
  }, [key]);
}
