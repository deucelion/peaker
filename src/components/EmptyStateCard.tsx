"use client";

import Link from "next/link";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export default function EmptyStateCard({
  title = "Kayıt bulunamadı",
  description,
  reason,
  primaryAction,
  secondaryAction,
  compact = false,
}: {
  title?: string;
  description: string;
  reason?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
}) {
  const wrapperPadding = compact ? "px-4 py-6" : "px-4 py-8 sm:px-6 sm:py-10";

  return (
    <div className={`rounded-xl border border-dashed border-white/10 bg-black/20 text-center ${wrapperPadding}`}>
      <p className="text-xs font-black uppercase tracking-wide text-gray-300">{title}</p>
      <p className="mt-1 text-xs font-semibold text-gray-500">{description}</p>
      {reason ? <p className="mt-2 text-[11px] font-medium text-gray-600">{reason}</p> : null}

      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {primaryAction?.href ? (
            <Link
              href={primaryAction.href}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#7c3aed] px-4 text-[11px] font-black uppercase text-white hover:bg-[#6d28d9]"
            >
              {primaryAction.label}
            </Link>
          ) : primaryAction?.onClick ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#7c3aed] px-4 text-[11px] font-black uppercase text-white hover:bg-[#6d28d9]"
            >
              {primaryAction.label}
            </button>
          ) : null}

          {secondaryAction?.href ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-[11px] font-black uppercase text-gray-300 hover:bg-white/5"
            >
              {secondaryAction.label}
            </Link>
          ) : secondaryAction?.onClick ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-[11px] font-black uppercase text-gray-300 hover:bg-white/5"
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
