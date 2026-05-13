"use client";

import type { ReactNode } from "react";

/**
 * Faz 7.2 — Generic responsive data table primitive.
 *
 * Mevcut tasarım dilini bozmadan; audit-log, payments, notifications gibi
 * tablo-benzeri görünümler için ortak bir wrapper sağlar. Render kontrolünü
 * tüketicilere bırakır (column config / cell renderer yok); amaç:
 * - boş / loading / error state UI'larını tek noktada sunmak
 * - mobile/desktop responsive scaffold'u standardize etmek
 *
 * Daha sonra (Faz 8) ColumnDef tabanlı versiyona geçirilebilir; şimdilik
 * incremental adoption pattern'i en güvenli yol.
 */
export function DataTable({
  caption,
  head,
  children,
  footer,
  className,
}: {
  caption?: ReactNode;
  head: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#121215] ${className ?? ""}`}
    >
      {caption && (
        <div className="border-b border-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
          {caption}
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead className="bg-white/[0.04] text-[9px] font-black uppercase tracking-widest text-gray-500">
            {head}
          </thead>
          <tbody className="divide-y divide-white/5">{children}</tbody>
        </table>
      </div>
      {footer && <div className="border-t border-white/5 px-4 py-3">{footer}</div>}
    </div>
  );
}

export default DataTable;
