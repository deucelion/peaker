"use client";

import type { ReactNode } from "react";
import { UiTabsNav, type UiTabItem } from "@/components/ui/navigation/UiTabsNav";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

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
        <h1 className={`${uiBrandingClasses.typography.h1} break-words`}>
          {title}
          {highlight ? (
            <span className="text-[color:var(--peaker-ui-PRIMARY)]"> {highlight}</span>
          ) : null}
        </h1>
        {description ? (
          <p className={`${uiBrandingClasses.typography.lead} break-words text-gray-400`}>{description}</p>
        ) : null}
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
  const items: UiTabItem[] = tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: tab.href,
    active: tab.href === activeHref,
  }));

  return <UiTabsNav tabs={items} ariaLabel={ariaLabel} className={className} />;
}

export default PageHeader;
