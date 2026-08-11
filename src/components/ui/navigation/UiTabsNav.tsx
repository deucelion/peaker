"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type UiTabLinkItem = {
  key: string;
  label: string;
  href: string;
  active?: boolean;
};

export type UiTabButtonItem = {
  key: string;
  label: string;
  onClick: () => void;
  active?: boolean;
};

export type UiTabItem = UiTabLinkItem | UiTabButtonItem;

function isLinkTab(tab: UiTabItem): tab is UiTabLinkItem {
  return "href" in tab;
}

export function UiTabsNav({
  tabs,
  ariaLabel,
  sticky = false,
  size = "md",
  subModule = false,
  prefix,
  className = "",
}: {
  tabs: ReadonlyArray<UiTabItem>;
  ariaLabel: string;
  sticky?: boolean;
  size?: "md" | "sm";
  subModule?: boolean;
  prefix?: ReactNode;
  className?: string;
}) {
  const navClass = [
    "ui-tabs-nav",
    sticky ? "ui-tabs-nav--sticky" : "",
    subModule ? "ui-tabs-nav--sub" : "",
    size === "sm" ? "ui-tabs-nav--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={navClass} aria-label={ariaLabel}>
      {prefix}
      {tabs.map((tab) => {
        const active = Boolean(tab.active);
        const tabClass = `ui-tabs-nav__tab ${active ? "ui-tabs-nav__tab--active" : "ui-tabs-nav__tab--inactive"}`;
        if (isLinkTab(tab)) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={tabClass}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        }
        return (
          <button
            key={tab.key}
            type="button"
            onClick={tab.onClick}
            className={tabClass}
            aria-pressed={active}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export default UiTabsNav;
