"use client";

import { ShieldCheck, ShieldOff, AlertTriangle, RotateCcw } from "lucide-react";
import { QUERY_TONE_CLASS, toneForErrorKind, type QueryErrorKind } from "@/lib/ui/queryState";

/**
 * Faz 7.2 / 7.3 — Inline hata bandı.
 *
 * - "permission_denied" / "auth_required" → amber tonu, kalkan ikonu (kullanıcı eylemi)
 * - "invalid_input" → amber tonu, uyarı ikonu (parametre düzeltmesi)
 * - "fetch_error" → red tonu, retry önerisi
 *
 * Retry için `onRetry` verildiğinde sağ üstte "Yenile" butonu gösterilir.
 */
export function InlineErrorState({
  errorKind,
  title,
  description,
  onRetry,
  className,
}: {
  errorKind: QueryErrorKind | null;
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const tone = toneForErrorKind(errorKind);
  const Icon = (() => {
    if (errorKind === "permission_denied" || errorKind === "auth_required") return ShieldCheck;
    if (errorKind === "invalid_input" || errorKind === "timeout") return AlertTriangle;
    return ShieldOff;
  })();
  const toneClass = QUERY_TONE_CLASS[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${toneClass} ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wide">{title}</p>
          {description && (
            <p className="text-[10px] font-semibold normal-case opacity-80">{description}</p>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center gap-2 self-start rounded-xl border border-white/15 bg-black/20 px-3 text-[10px] font-black uppercase tracking-widest hover:border-white/30"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export default InlineErrorState;
