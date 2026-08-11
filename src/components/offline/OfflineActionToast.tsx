"use client";

import type { OfflineReplayResult } from "@/lib/offline/types";
import { OVERLAY_Z, overlayZIndex } from "@/components/ui/overlay";

export function OfflineActionToast({ result }: { result: OfflineReplayResult | null }) {
  if (!result || result.processed === 0) return null;

  const ok = result.failed === 0 && result.succeeded > 0;
  return (
    <div className="ui-toast-shell" style={{ zIndex: overlayZIndex(OVERLAY_Z.TOAST) }} role="status">
      <div
        className={`rounded-xl border px-4 py-3 text-[11px] font-bold shadow-xl ${
          ok
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100"
            : "border-amber-500/30 bg-amber-500/15 text-amber-100"
        }`}
      >
        {ok
          ? `${result.succeeded} işlem senkronize edildi.`
          : `${result.succeeded} başarılı, ${result.failed} hata. Bekleyen işlemleri kontrol edin.`}
      </div>
    </div>
  );
}
