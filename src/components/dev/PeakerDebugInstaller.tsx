"use client";

import { useEffect } from "react";

/**
 * Faz 13.8 — DEV ONLY: `window.__PEAKER_DEBUG__` (production build’de parent
 * koşulu ile tree-shake edilir).
 */
export function PeakerDebugInstaller() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void import("@/lib/dev/installPeakerDebug").then((m) => m.installPeakerDebug());
  }, []);
  return null;
}
