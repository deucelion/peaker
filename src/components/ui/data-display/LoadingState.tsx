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
      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <Loader2 className="size-3.5 animate-spin text-[#7c3aed]" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-[#121215] p-6"
    >
      <Loader2 className="size-7 animate-spin text-[#7c3aed]" aria-hidden />
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
    </div>
  );
}

export default LoadingState;
