"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Faz 6.1 — Haftalık ders programı için ortak select varyantı.
 * Markup birebir orijinaliyle aynı.
 */
export function SelectPremium({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ui-select min-h-11 w-full appearance-none rounded-xl border-white/10 bg-[#17171f] pr-10 text-sm font-semibold"
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c4b5fd]"
        />
      </div>
    </label>
  );
}

export default SelectPremium;
