"use client";

import { Loader2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import type { OfflineQueuedAction } from "@/lib/offline/types";
import { clearOfflineAction } from "@/lib/offline/offlineActionQueue";

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  syncing: "Senkronize ediliyor",
  failed: "Hata",
  conflict: "Çakışma",
  requires_confirmation: "Onay gerekli",
  completed: "Tamamlandı",
};

export function PendingActionsDrawer({
  open,
  onClose,
  items,
  syncing,
  onRetry,
  onRetryWithConfirmation,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  items: OfflineQueuedAction[];
  syncing: boolean;
  onRetry: () => void;
  onRetryWithConfirmation?: () => void;
  onRefresh: () => void;
}) {
  if (!open) return null;

  const needsConfirm = items.some((i) => i.status === "requires_confirmation");

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Kapat" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(88dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#17171d] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-white">Bekleyen işlemler</h2>
          <button type="button" onClick={onClose} className="ui-btn-ghost min-h-10 px-3 text-[10px]">
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-[11px] font-bold text-gray-500">Bekleyen işlem yok.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase text-white">{item.title}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-gray-500">
                        {STATUS_LABEL[item.status] ?? item.status} ·{" "}
                        {new Date(item.createdAt).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      {item.lastError ? (
                        <p className="mt-1 flex items-start gap-1 text-[10px] text-rose-300">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" aria-hidden />
                          {item.lastError}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearOfflineAction(item.id);
                        onRefresh();
                      }}
                      className="shrink-0 rounded-lg border border-white/10 p-2 text-gray-500 touch-manipulation"
                      aria-label="Sil"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={syncing || items.length === 0}
            onClick={onRetry}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
            Tekrar dene
          </button>
          {needsConfirm && onRetryWithConfirmation ? (
            <button
              type="button"
              disabled={syncing}
              onClick={onRetryWithConfirmation}
              className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-[10px] font-black uppercase text-amber-100"
            >
              Onaylı sync
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
