"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

export function CompactTimelineItem({
  title,
  time,
  status,
  statusTone = "neutral",
}: {
  title: string;
  time?: string;
  status?: string;
  statusTone?: "neutral" | "purple" | "success" | "warning";
}) {
  const statusClass =
    statusTone === "success"
      ? "text-emerald-400"
      : statusTone === "warning"
        ? "text-amber-300"
        : statusTone === "purple"
          ? "ui-kpi-card__trend"
          : "text-gray-500";

  return (
    <li className={`${uiBrandingClasses.kpi.card} flex min-w-0 items-center justify-between gap-2 !py-2 !px-2.5 text-[10px]`}>
      <span className="min-w-0 truncate font-bold text-white">{title}</span>
      {time ? <span className="ui-kpi-card__hint shrink-0 tabular-nums">{time}</span> : null}
      {status ? <span className={`shrink-0 font-black uppercase ${statusClass}`}>{status}</span> : null}
    </li>
  );
}
