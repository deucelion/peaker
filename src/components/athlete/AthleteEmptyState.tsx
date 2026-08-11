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
  const sizeClass = compact ? "ui-empty-state--compact" : "ui-empty-state--default";

  return (
    <div className={`ui-empty-state ${sizeClass} min-w-0 border-dashed px-4 text-center`}>
      {Icon ? (
        <div className="ui-empty-state__icon-wrap mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl">
          <Icon className="text-gray-500" size={22} aria-hidden />
        </div>
      ) : null}
      <p className="text-xs font-black uppercase italic tracking-wide text-white">{title}</p>
      <p className="ui-empty-state__description mx-auto mt-2 max-w-md text-[11px] font-bold">{description}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-[10px] font-medium text-gray-600">{hint}</p> : null}
      {action ? (
        <HardNavLink href={action.href} className="ui-empty-state__action mt-4">
          {action.label}
        </HardNavLink>
      ) : null}
    </div>
  );
}
