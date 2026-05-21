"use client";

import { WifiOff } from "lucide-react";

export function OfflineBanner({ pendingCount }: { pendingCount: number }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-100"
    >
      <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-black uppercase tracking-wide">Çevrimdışı mod</p>
        <p className="mt-0.5 text-amber-200/80">
          Güvenli işlemler cihazınızda bekletilir.
          {pendingCount > 0 ? ` Bekleyen: ${pendingCount}.` : " Bağlantı gelince senkron denenecek."}
        </p>
      </div>
    </div>
  );
}
