"use client";

import { Loader2 } from "lucide-react";

/**
 * Faz 7.2 — Standart yükleme banner'ı.
 * Page-level loading'ler için Skeleton'lar tercih edilmelidir; bu component
 * inline / panel-level loading için kullanılır.
 */
export function LoadingState({
  label = "Yükleniyor...",
  variant = "panel",
}: {
  label?: string;
  variant?: "panel" | "inline";
}) {
  if (variant === "inline") {
    return (
      <span className="ui-loading-inline">
        <Loader2 className="ui-loading-inline__spinner size-3.5 animate-spin" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <div role="status" aria-live="polite" className="ui-loading-panel">
      <Loader2 className="ui-loading-panel__spinner size-7 animate-spin" aria-hidden />
      <p className="ui-loading-panel__label">{label}</p>
    </div>
  );
}

export default LoadingState;
