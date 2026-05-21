"use client";

import { formatRelativeTimeTr } from "@/lib/realtime/formatRelativeTimeTr";
import { useDocumentVisibility } from "@/lib/hooks/useDocumentVisibility";
import { useEffect, useMemo, useState } from "react";

export function RelativeTimeText({ iso, className }: { iso: string; className?: string }) {
  const visible = useDocumentVisibility();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [visible, iso]);

  const label = useMemo(() => {
    void tick;
    return formatRelativeTimeTr(iso);
  }, [iso, tick]);

  return <span className={className}>{label}</span>;
}

export type LiveStatusTone = "live" | "syncing" | "degraded" | "offline" | "reconnecting";

const toneClass: Record<LiveStatusTone, string> = {
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  syncing: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  degraded: "border-amber-500/35 bg-amber-500/10 text-amber-100",
  offline: "border-white/15 bg-white/5 text-gray-500",
  reconnecting: "border-violet-500/35 bg-violet-500/10 text-violet-200",
};

export function LiveStatusBadge({
  tone,
  label,
  pulse,
}: {
  tone: LiveStatusTone;
  label: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${toneClass[tone]}`}
    >
      {pulse && tone === "live" ? (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
        </span>
      ) : null}
      {label}
    </span>
  );
}

export function LiveConnectionStrip({
  status,
  lastSyncLabel,
}: {
  status: LiveStatusTone;
  lastSyncLabel: string | null;
}) {
  const statusCopy: Record<LiveStatusTone, string> = {
    live: "Canlı",
    syncing: "Senkronize…",
    degraded: "Kısıtlı bağlantı",
    offline: "Çevrimdışı",
    reconnecting: "Yeniden bağlanıyor",
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-400">
      <LiveStatusBadge tone={status} label={statusCopy[status]} pulse={status === "live"} />
      {lastSyncLabel ? (
      <span className="tabular-nums text-gray-500">
        <span className="text-gray-600">Son güncelleme:</span> {lastSyncLabel}
      </span>
      ) : null}
    </div>
  );
}
