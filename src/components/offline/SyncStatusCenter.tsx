"use client";

import Link from "next/link";
import {
  Loader2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Shield,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import type { OfflineQueuedAction, OfflineReplayResult } from "@/lib/offline/types";
import { clearOfflineAction } from "@/lib/offline/offlineActionQueue";
import { conflictUiForActionKind } from "@/lib/offline/conflictMapping";
import { riskForKind } from "@/lib/offline/actionRegistry";

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  syncing: "Senkronize ediliyor",
  failed: "Hata",
  conflict: "Çakışma",
  requires_confirmation: "Onay gerekli",
  completed: "Tamamlandı",
};

const RISK_LABEL: Record<string, string> = {
  safe: "Güvenli",
  requires_confirmation: "Onaylı",
  blocked: "Engelli",
};

function summarize(items: OfflineQueuedAction[]) {
  return {
    total: items.filter((i) => i.status !== "completed").length,
    pending: items.filter((i) => i.status === "pending").length,
    failed: items.filter((i) => i.status === "failed").length,
    conflict: items.filter((i) => i.status === "conflict").length,
    confirm: items.filter((i) => i.status === "requires_confirmation").length,
    risky: items.filter((i) => riskForKind(i.kind) === "blocked").length,
  };
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function SyncStatusCenter({
  open,
  onClose,
  items,
  scopeKey,
  syncing,
  lastResult,
  onRetry,
  onRetryWithConfirmation,
  onRefresh,
  onRetryOne,
  onConfirmOne,
}: {
  open: boolean;
  onClose: () => void;
  items: OfflineQueuedAction[];
  scopeKey: string;
  syncing: boolean;
  lastResult: OfflineReplayResult | null;
  onRetry: () => void;
  onRetryWithConfirmation?: () => void;
  onRefresh: () => void;
  onRetryOne: (id: string) => void;
  onConfirmOne?: (id: string) => void;
}) {
  if (!open) return null;

  const stats = summarize(items);
  const needsConfirm = stats.confirm > 0;
  const scopeShort = scopeKey.replace(":", " · ");

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Kapat" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(90dvh,680px)] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#17171d] shadow-2xl sm:rounded-2xl"
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black uppercase tracking-wide text-white">Senkron durumu</h2>
            <button type="button" onClick={onClose} className="ui-btn-ghost min-h-10 px-3 text-[10px]">
              Kapat
            </button>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-gray-500">
            <Shield size={12} aria-hidden /> Kapsam: {scopeShort}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black uppercase">
            <span className="rounded-md border border-white/10 px-2 py-0.5 text-gray-400">
              Bekleyen {stats.total}
            </span>
            {stats.failed > 0 ? (
              <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-200">
                Hata {stats.failed}
              </span>
            ) : null}
            {stats.conflict > 0 ? (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                Çakışma {stats.conflict}
              </span>
            ) : null}
            {stats.confirm > 0 ? (
              <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-orange-200">
                Onay {stats.confirm}
              </span>
            ) : null}
          </div>
          {lastResult?.lastSyncAt ? (
            <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-400/90">
              <CheckCircle2 size={12} aria-hidden />
              Son başarılı sync: {formatWhen(lastResult.lastSyncAt)}
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-[11px] font-bold text-gray-500">Bekleyen işlem yok.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const ui = conflictUiForActionKind(item.kind, item.lastError);
                const risk = riskForKind(item.kind);
                const needsUserConfirm = item.status === "requires_confirmation";
                const canRetry =
                  item.status === "failed" ||
                  item.status === "conflict" ||
                  (item.status === "pending" && risk === "safe");

                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase text-white">{item.title}</p>
                        {item.subjectLabel ? (
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-400">
                            {item.subjectLabel}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[10px] font-bold text-gray-500">
                          {STATUS_LABEL[item.status] ?? item.status} · {ui.label} ·{" "}
                          {RISK_LABEL[risk] ?? risk}
                        </p>
                        <p className="mt-0.5 text-[9px] text-gray-600">
                          Oluşturulma: {formatWhen(item.createdAt)}
                          {item.lastAttemptAt ? ` · Son deneme: ${formatWhen(item.lastAttemptAt)}` : ""}
                          {item.retries > 0 ? ` · Deneme ${item.retries}` : ""}
                        </p>
                        {item.lastError ? (
                          <p className="mt-1 text-[10px] text-rose-300">{ui.hint || item.lastError}</p>
                        ) : needsUserConfirm ? (
                          <p className="mt-1 text-[10px] text-amber-300">
                            Onaylı sync — otomatik gönderilmez.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {needsUserConfirm && onConfirmOne ? (
                        <button
                          type="button"
                          onClick={() => onConfirmOne(item.id)}
                          disabled={syncing}
                          className="min-h-9 rounded-lg bg-[#7c3aed] px-2.5 text-[9px] font-black uppercase text-white disabled:opacity-50"
                        >
                          Onayla ve gönder
                        </button>
                      ) : null}
                      {canRetry ? (
                        <button
                          type="button"
                          onClick={() => onRetryOne(item.id)}
                          disabled={syncing}
                          className="min-h-9 rounded-lg border border-[#7c3aed]/30 px-2.5 text-[9px] font-black uppercase text-[#c4b5fd] disabled:opacity-50"
                        >
                          Tekrar dene
                        </button>
                      ) : null}
                      {item.navigationHref ? (
                        <Link
                          href={item.navigationHref}
                          onClick={onClose}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[9px] font-black uppercase text-gray-300"
                        >
                          <ExternalLink size={12} aria-hidden /> Ekrana git
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          clearOfflineAction(item.id);
                          onRefresh();
                        }}
                        className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[9px] font-black uppercase text-gray-500"
                      >
                        <Trash2 size={12} aria-hidden /> Sil
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {stats.risky > 0 ? (
            <p className="mt-3 flex items-start gap-1 text-[10px] text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
              Riskli işlemler otomatik gönderilmez; ilgili ekrandan tekrar yapın.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={syncing || stats.total === 0}
            onClick={onRetry}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={14} aria-hidden />
            )}
            Güvenli sync
          </button>
          {needsConfirm && onRetryWithConfirmation ? (
            <button
              type="button"
              disabled={syncing}
              onClick={onRetryWithConfirmation}
              className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-[10px] font-black uppercase text-amber-100 disabled:opacity-50"
            >
              Tümünü onayla
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
