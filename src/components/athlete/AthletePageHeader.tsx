"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

type AthletePageHeaderProps = {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
};

export function AthletePageHeader({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel = "Panele dön",
  action,
}: AthletePageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
      <div className="min-w-0 space-y-2">
        {backHref ? (
          <Link
            href={backHref}
            className="ui-breadcrumb__link -ml-1 inline-flex min-h-10 touch-manipulation items-center gap-2 rounded-lg px-1 text-[10px] font-black uppercase tracking-widest transition-colors sm:hover:bg-white/[0.03]"
          >
            <ArrowLeft size={14} className="shrink-0" aria-hidden />
            <span className="break-words">{backLabel}</span>
          </Link>
        ) : null}
        {eyebrow ? (
          <div className="flex items-center gap-2">
            <div
              className="h-px w-6 bg-[color:var(--peaker-ui-PRIMARY)]"
              aria-hidden
            />
            <span className={`${uiBrandingClasses.kpi.cardTrend} text-[9px] tracking-[0.35em]`}>
              {eyebrow}
            </span>
          </div>
        ) : null}
        <h1 className={`${uiBrandingClasses.typography.h1} break-words text-2xl sm:text-3xl`}>
          {title}
        </h1>
        {subtitle ? (
          <p
            className={`${uiBrandingClasses.typography.lead} max-w-xl break-words border-l-2 pl-3 text-[10px] font-bold uppercase tracking-wide italic`}
            style={{
              borderLeftColor:
                "color-mix(in srgb, var(--peaker-ui-PRIMARY) 40%, transparent)",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
