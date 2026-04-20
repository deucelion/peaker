"use client";

import { useEffect } from "react";

type Options = {
  enabled: boolean;
  message?: string;
};

const DEFAULT_MESSAGE = "Kayıt edilmemiş değişiklikler var, devam etmek istiyor musunuz?";

export function useUnsavedChangesGuard({ enabled, message = DEFAULT_MESSAGE }: Options) {
  useEffect(() => {
    if (!enabled) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank") return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const ok = window.confirm(message);
      if (!ok) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const popstateHandler = () => {
      const ok = window.confirm(message);
      if (ok) {
        window.removeEventListener("popstate", popstateHandler);
        window.history.back();
      } else {
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", clickHandler, true);
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", popstateHandler);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", clickHandler, true);
      window.removeEventListener("popstate", popstateHandler);
    };
  }, [enabled, message]);
}
