"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* registration optional */
      });
  }, []);

  return null;
}
