"use client";

import type { PerformanceTabKey } from "@/lib/navigation/performanceTabs";
import { PERFORMANCE_TABS, isPerformanceTabActive } from "@/lib/navigation/performanceTabs";
import { UiTabsNav } from "@/components/ui/navigation/UiTabsNav";

type PerformanceTabsNavProps = {
  activeKey: PerformanceTabKey;
  className?: string;
  sticky?: boolean;
};

export function PerformanceTabsNav({ activeKey, className = "", sticky = true }: PerformanceTabsNavProps) {
  return (
    <UiTabsNav
      ariaLabel="Performans alt gezinim"
      sticky={sticky}
      className={`${sticky ? "!top-0" : ""} ${className}`.trim()}
      tabs={PERFORMANCE_TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        href: tab.href,
        active: isPerformanceTabActive(tab, activeKey),
      }))}
    />
  );
}
