"use client";

import { Loader2 } from "lucide-react";
import { SkeletonDashboardShell, SkeletonTable } from "@/components/ui/skeletons";

type QueryLoadingShellProps = {
  variant?: "inline" | "table" | "dashboard";
  label?: string;
  tableRows?: number;
  className?: string;
};

/**
 * FAZ 21 — Ortak yükleme gösterimi (spinner spam azaltma).
 * İlk yükleme: skeleton; soft refresh: inline spinner.
 */
export function QueryLoadingShell({
  variant = "inline",
  label = "Yükleniyor…",
  tableRows = 5,
  className = "",
}: QueryLoadingShellProps) {
  if (variant === "dashboard") {
    return (
      <div className={className}>
        <SkeletonDashboardShell />
      </div>
    );
  }
  if (variant === "table") {
    return <SkeletonTable rows={tableRows} className={className} />;
  }
  return (
    <div
      className={`ui-loading-panel min-h-[120px] px-6 py-10 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 className="ui-loading-panel__spinner size-8 animate-spin" aria-hidden />
      <p className="ui-loading-panel__label text-[11px] font-bold normal-case tracking-wide">{label}</p>
    </div>
  );
}

export function SoftRefreshIndicator({ active, className = "" }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <span className={`ui-loading-refresh ${className}`} role="status" aria-live="polite">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      Güncelleniyor
    </span>
  );
}
