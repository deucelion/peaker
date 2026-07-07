"use client";

import { HardNavLink } from "@/components/navigation/HardNavLink";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

type Tone = "purple" | "amber" | "emerald" | "neutral";

const TONE: Record<Tone, string> = {
  purple: "border-[#7c3aed]/20 bg-[#7c3aed]/10 text-[#c4b5fd]",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  neutral: "border-white/10 bg-white/5 text-gray-300",
};

export function CompactActionCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  hint,
  tone = "purple",
}: {
  href: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <HardNavLink
      href={href}
      className={`group flex min-h-11 touch-manipulation items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${TONE[tone]}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Icon size={16} className="shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-wide opacity-80">{eyebrow}</p>
          <p className="truncate text-[11px] font-black uppercase text-white">{title}</p>
          {hint ? <p className="truncate text-[9px] font-bold text-gray-500">{hint}</p> : null}
        </div>
      </div>
      <ChevronRight size={14} className="shrink-0 opacity-50 group-active:opacity-100" aria-hidden />
    </HardNavLink>
  );
}
