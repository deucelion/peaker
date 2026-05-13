"use client";

import type { ReactNode } from "react";

/**
 * Faz 7.2 — Tablo üstü standart toolbar.
 *
 * Görsel düzen, mevcut audit-log / muhasebe-finans toolbar pattern'leriyle
 * tutarlıdır. Sol tarafta toolbar içeriği (filter chips / search), sağ tarafta
 * actions (refresh / export / filter trigger).
 */
export function DataTableToolbar({
  children,
  actions,
  className,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#121215] p-4 sm:p-5 sm:flex-row sm:items-end sm:justify-between ${className ?? ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default DataTableToolbar;
