"use client";

import type { ReactNode } from "react";

/**
 * Faz 6.2 — FilterBar primitive.
 *
 * Standart filtre çerçevesi: rounded-2xl border + bg-[#121215]/80, içeride
 * filter chips + apply/reset slotları. Davranış yok, yalnızca konteyner.
 */
export function FilterBar({
  ariaLabel = "Filtre",
  children,
  className = "",
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-2xl border border-white/8 bg-[#121215]/80 p-4 sm:p-5 space-y-4 min-w-0 ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Filter chip butonu. Aktif/pasif tonu standart tutar.
 */
export function FilterChip({
  active,
  onClick,
  children,
  ariaLabel,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-wide touch-manipulation ${
        active
          ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
          : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * KPI grid wrapper. Sayfalar arası gap/columns standart.
 */
export function KpiGrid({
  count = 4,
  children,
  className = "",
}: {
  count?: 3 | 4 | 5 | 6 | 7;
  children: ReactNode;
  className?: string;
}) {
  const colMap: Record<number, string> = {
    3: "grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3",
    4: "grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-2 xl:grid-cols-4",
    5: "grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
    6: "grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
    7: "grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-7",
  };
  return (
    <div className={`grid ${colMap[count]} gap-2 sm:gap-3 min-w-0 ${className}`}>{children}</div>
  );
}

/**
 * SectionCard — kart hiyerarşisi standart.
 * `tone="muted"` daha az vurgulu, `tone="default"` ana kart.
 */
export function SectionCard({
  title,
  icon,
  actions,
  children,
  tone = "default",
  className = "",
  ariaLabel,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "muted";
  className?: string;
  ariaLabel?: string;
}) {
  const wrapper =
    tone === "muted"
      ? "rounded-2xl border border-white/8 bg-[#121215]/80 p-4 sm:p-5"
      : "rounded-2xl border border-white/10 bg-[#121215]/90 p-4 sm:p-5";
  return (
    <section aria-label={ariaLabel} className={`${wrapper} min-w-0 ${className}`}>
      {title || actions ? (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          {title ? (
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
              {icon ? <span className="text-[#7c3aed]">{icon}</span> : null}
              <span>{title}</span>
            </h3>
          ) : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
