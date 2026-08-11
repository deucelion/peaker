"use client";

import type { ReactNode } from "react";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

/**
 * Faz 6.2 — FilterBar primitive.
 *
 * Standart filtre çerçevesi: ui-toolbar shell, içeride filter chips + apply/reset slotları.
 * Davranış yok, yalnızca konteyner.
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
      className={`${uiBrandingClasses.layout.toolbar} space-y-4 min-w-0 ${className}`}
    >
      {children}
    </section>
  );
}

const FILTER_CHIP_ACTIVE_CLASS =
  "border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_50%,transparent)] bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_15%,transparent)] text-white";
const FILTER_CHIP_INACTIVE_CLASS =
  "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300";

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
        active ? FILTER_CHIP_ACTIVE_CLASS : FILTER_CHIP_INACTIVE_CLASS
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
    tone === "muted" ? uiBrandingClasses.kpi.band : uiBrandingClasses.kpi.section;

  return (
    <section aria-label={ariaLabel} className={`${wrapper} min-w-0 ${className}`}>
      {title || actions ? (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          {title ? (
            <h3 className="ui-label flex items-center gap-2 tracking-[0.25em]">
              {icon ? (
                <span className="text-[color:var(--peaker-ui-PRIMARY)]">{icon}</span>
              ) : null}
              <span>{title}</span>
            </h3>
          ) : (
            <span />
          )}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
