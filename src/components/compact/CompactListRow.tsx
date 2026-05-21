"use client";

import Link from "next/link";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const BADGE: Record<BadgeTone, string> = {
  neutral: "border-white/10 bg-white/5 text-gray-400",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  danger: "border-rose-500/25 bg-rose-500/10 text-rose-200",
};

export function CompactListRow({
  title,
  meta,
  badge,
  href,
  actions,
}: {
  title: string;
  meta?: string;
  badge?: { label: string; tone?: BadgeTone };
  href?: string;
  actions?: Array<{ label: string; href: string; primary?: boolean }>;
}) {
  const inner = (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-black uppercase text-white">{title}</p>
        {meta ? <p className="truncate text-[10px] font-bold text-gray-500">{meta}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {badge ? (
          <span
            className={`rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase ${BADGE[badge.tone ?? "neutral"]}`}
          >
            {badge.label}
          </span>
        ) : null}
        {actions?.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-[9px] font-black uppercase touch-manipulation ${
              a.primary
                ? "border border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border border-white/10 bg-white/5 text-gray-400"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block touch-manipulation">
        {inner}
      </Link>
    );
  }
  return inner;
}
