"use client";

import Link from "next/link";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const BADGE: Record<BadgeTone, string> = {
  neutral: "ui-badge-neutral",
  success: "ui-badge-success",
  warning: "ui-badge-warning",
  danger: "ui-badge-danger",
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
    <div
      className={`${uiBrandingClasses.card.inner} flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-black uppercase text-white">{title}</p>
        {meta ? <p className="ui-kpi-card__hint truncate text-[10px] font-bold">{meta}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {badge ? (
          <span className={`ui-badge ${BADGE[badge.tone ?? "neutral"]} text-[9px]`}>{badge.label}</span>
        ) : null}
        {actions?.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-[9px] font-black uppercase touch-manipulation ${
              a.primary ? "ui-empty-state__action" : "ui-btn-ghost min-h-9 px-2.5 text-[9px]"
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
