"use client";

import { Cloud, CloudOff, Loader2 } from "lucide-react";

export function SyncStatusBadge({
  online,
  pendingCount,
  syncing,
  onOpenPending,
}: {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  onOpenPending?: () => void;
}) {
  const label = syncing
    ? "Senkronize ediliyor"
    : online
      ? pendingCount > 0
        ? `Bekleyen ${pendingCount}`
        : "Senkron"
      : "Çevrimdışı";

  return (
    <button
      type="button"
      onClick={onOpenPending}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-300 touch-manipulation"
      aria-label={label}
    >
      {syncing ? (
        <Loader2 size={14} className="animate-spin text-[#7c3aed]" aria-hidden />
      ) : online ? (
        <Cloud size={14} className="text-emerald-400" aria-hidden />
      ) : (
        <CloudOff size={14} className="text-amber-400" aria-hidden />
      )}
      <span className="max-w-[7rem] truncate">{label}</span>
      {pendingCount > 0 ? (
        <span className="min-w-[1.1rem] rounded-full bg-[#7c3aed] px-1 text-[9px] font-black text-white">
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      ) : null}
    </button>
  );
}
