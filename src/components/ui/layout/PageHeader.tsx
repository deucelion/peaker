"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Faz 6.2 — Shared UI primitive: PageHeader.
 *
 * Standart sayfa başlığı bandı. Title + altyazı + sağda aksiyon slot'u.
 * `subnav` prop'u, sayfa altı tab/link grubu için (örn. performans tabları).
 *
 * KURAL: Davranış yok, yalnızca markup. Başlık tipografisi `ui-h1`/`ui-lead`
 * mevcut Tailwind utility'lerine sadık kalır.
 */
export function PageHeader({
  title,
  highlight,
  description,
  subDescription,
  actions,
  subnav,
  className = "",
}: {
  title: string;
  highlight?: string;
  description?: ReactNode;
  subDescription?: ReactNode;
  actions?: ReactNode;
  subnav?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between min-w-0 ${className}`}>
      <div className="min-w-0 space-y-2">
        <h1 className="ui-h1 break-words">
          {title}
          {highlight ? <span className="text-[#7c3aed]"> {highlight}</span> : null}
        </h1>
        {description ? <p className="ui-lead break-words text-gray-400">{description}</p> : null}
        {subDescription ? subDescription : null}
        {subnav ? <div className="pt-1">{subnav}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center w-full lg:w-auto shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/**
 * Tab/link grubu standart pattern'i. Aynı yükseklik, aynı padding, aynı state ringi.
 * Aktif tab'i `aria-current="page"` ile işaretler.
 */
export function PageSubnav({
  tabs,
  activeHref,
  className = "",
  ariaLabel = "Sayfa alt gezinim",
}: {
  tabs: ReadonlyArray<{ key: string; label: string; href: string }>;
  activeHref?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <nav className={`flex flex-wrap gap-2 ${className}`} aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
              isActive
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default PageHeader;
