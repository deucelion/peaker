"use client";

import type { LucideIcon } from "lucide-react";
import { HardNavLink } from "@/components/navigation/HardNavLink";

type AthleteEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  action?: { label: string; href: string };
  compact?: boolean;
};

export function AthleteEmptyState({
  icon: Icon,
  title,
  description,
  hint,
  action,
  compact = false,
}: AthleteEmptyStateProps) {
  const py = compact ? "py-8" : "py-10 sm:py-12";

  return (
    <div
      className={`min-w-0 rounded-2xl border border-dashed border-white/10 bg-[#121215] px-4 text-center ${py}`}
    >
      {Icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#7c3aed]/10">
          <Icon className="text-gray-500" size={22} aria-hidden />
        </div>
      ) : null}
      <p className="text-xs font-black uppercase italic tracking-wide text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[11px] font-bold text-gray-500">{description}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-[10px] font-medium text-gray-600">{hint}</p> : null}
      {action ? (
        <HardNavLink
          href={action.href}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation"
        >
          {action.label}
        </HardNavLink>
      ) : null}
    </div>
  );
}
