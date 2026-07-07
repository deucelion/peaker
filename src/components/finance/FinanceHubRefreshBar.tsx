"use client";

import { Loader2 } from "lucide-react";
import { LiveConnectionStrip, type LiveStatusTone } from "@/components/realtime/LiveStatusPrimitives";
import { formatRelativeTimeTr } from "@/lib/realtime/formatRelativeTimeTr";

type Props = {
  loading: boolean;
  hasSnapshot: boolean;
  loadError: string | null;
  lastSyncAt: string | null;
  onRefresh: () => void;
  refreshAck?: boolean;
  exportSlot?: React.ReactNode;
  periodSlot?: React.ReactNode;
};

export function FinanceHubRefreshBar({
  loading,
  hasSnapshot,
  loadError,
  lastSyncAt,
  onRefresh,
  refreshAck = false,
  exportSlot,
  periodSlot,
}: Props) {
  const tone: LiveStatusTone = loadError ? "degraded" : loading && hasSnapshot ? "syncing" : "live";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {periodSlot}
      <LiveConnectionStrip
        status={tone}
        lastSyncLabel={lastSyncAt ? formatRelativeTimeTr(lastSyncAt) : hasSnapshot ? "az önce" : null}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading && !hasSnapshot}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:bg-white/5 disabled:opacity-50 sm:min-h-9"
          aria-busy={loading && hasSnapshot}
        >
          {loading && hasSnapshot ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
          Yenile
        </button>
        {exportSlot}
        {refreshAck ? (
          <span className="text-[10px] font-semibold text-emerald-400/90" role="status">
            Güncellendi
          </span>
        ) : null}
      </div>
    </div>
  );
}
