"use client";

import { HardNavLink } from "@/components/navigation/HardNavLink";
import type { LucideIcon } from "lucide-react";

type Tone = "green" | "yellow" | "orange" | "rose" | "neutral";

const SHELL: Record<Tone, string> = {
  green: "border-emerald-500/20 bg-emerald-500/5",
  yellow: "border-amber-500/20 bg-amber-500/5",
  orange: "border-orange-500/20 bg-orange-500/5",
  rose: "border-rose-500/20 bg-rose-500/5",
  neutral: "border-white/10 bg-white/[0.02]",
};

const TEXT: Record<Tone, string> = {
  green: "text-emerald-300",
  yellow: "text-amber-200",
  orange: "text-orange-200",
  rose: "text-rose-300",
  neutral: "text-gray-300",
};

export function CompactFinanceCard({
  href,
  icon: Icon,
  label,
  statusLabel,
  amount,
  dueLabel,
  supportText,
  tone = "neutral",
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  statusLabel: string;
  amount?: string | number | null;
  dueLabel?: string;
  supportText?: string;
  tone?: Tone;
}) {
  const body = (
    <div className={`rounded-xl border p-3 ${SHELL[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className={`shrink-0 ${TEXT[tone]}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`truncate text-[11px] font-black uppercase ${TEXT[tone]}`}>{statusLabel}</p>
          </div>
        </div>
        {amount != null ? (
          <span className="shrink-0 text-sm font-black tabular-nums text-white">₺{amount}</span>
        ) : null}
      </div>
      {dueLabel ? (
        <p className="mt-2 text-[9px] font-bold text-gray-500">
          Vade: <span className="text-gray-400">{dueLabel}</span>
        </p>
      ) : null}
      {supportText ? (
        <p className="mt-1 line-clamp-2 text-[9px] font-medium text-gray-600">{supportText}</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <HardNavLink href={href} className="block touch-manipulation">
        {body}
      </HardNavLink>
    );
  }
  return body;
}
