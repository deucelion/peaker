"use client";

import Link from "next/link";
import type { PerformanceTabKey } from "@/lib/navigation/performanceTabs";
import { PERFORMANCE_TABS, isPerformanceTabActive } from "@/lib/navigation/performanceTabs";

type PerformanceTabsNavProps = {
  activeKey: PerformanceTabKey;
  className?: string;
  sticky?: boolean;
};

export function PerformanceTabsNav({ activeKey, className = "", sticky = true }: PerformanceTabsNavProps) {
  return (
    <nav
      className={`flex flex-wrap gap-2 ${sticky ? "sticky top-0 z-20 -mx-1 bg-[#0a0a0b]/95 px-1 py-2 backdrop-blur-md lg:top-0" : ""} ${className}`}
      aria-label="Performans alt gezinim"
    >
      {PERFORMANCE_TABS.map((tab) => {
        const active = isPerformanceTabActive(tab, activeKey);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
              active
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
