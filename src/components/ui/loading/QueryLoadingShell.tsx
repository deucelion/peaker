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
      className={`flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#121215] px-6 py-10 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 className="size-8 animate-spin text-[#7c3aed]" aria-hidden />
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

export function SoftRefreshIndicator({ active, className = "" }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-[#7c3aed]/25 bg-[#7c3aed]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#ddd6fe] ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-3 animate-spin" aria-hidden />
      Güncelleniyor
    </span>
  );
}
