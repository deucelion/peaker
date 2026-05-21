"use client";

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
          ? "text-[#c4b5fd]"
          : "text-gray-500";

  return (
    <li className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2 text-[10px]">
      <span className="min-w-0 truncate font-bold text-white">{title}</span>
      {time ? <span className="shrink-0 tabular-nums text-gray-600">{time}</span> : null}
      {status ? <span className={`shrink-0 font-black uppercase ${statusClass}`}>{status}</span> : null}
    </li>
  );
}
