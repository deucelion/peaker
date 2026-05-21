"use client";

import type { OfflineReplayResult } from "@/lib/offline/types";

export function OfflineActionToast({ result }: { result: OfflineReplayResult | null }) {
  if (!result || result.processed === 0) return null;

  const ok = result.failed === 0 && result.succeeded > 0;
  return (
    <div
      className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-4 right-4 z-[125] mx-auto max-w-md rounded-xl border px-4 py-3 text-[11px] font-bold shadow-xl sm:left-auto sm:right-6 ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100"
          : "border-amber-500/30 bg-amber-500/15 text-amber-100"
      }`}
      role="status"
    >
      {ok
        ? `${result.succeeded} işlem senkronize edildi.`
        : `${result.succeeded} başarılı, ${result.failed} hata. Bekleyen işlemleri kontrol edin.`}
    </div>
  );
}
