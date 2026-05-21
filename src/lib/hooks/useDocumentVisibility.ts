"use client";

import { useEffect, useState } from "react";

/** `true` when `document.visibilityState === "visible"`. SSR-safe default `true`. */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );

  useEffect(() => {
    const run = () => setVisible(document.visibilityState === "visible");
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, []);

  return visible;
}
