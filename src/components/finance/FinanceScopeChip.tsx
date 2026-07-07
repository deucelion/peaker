"use client";

export type FinanceScopeKind = "period" | "all_time" | "overdue" | "new_record";

const SCOPE_META: Record<
  FinanceScopeKind,
  { label: string; tone: string; hint: string }
> = {
  period: {
    label: "Bu dönem",
    tone: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    hint: "KPI ve tablolar yalnızca seçili ay veya tarih aralığını kapsar.",
  },
  all_time: {
    label: "Tüm zaman",
    tone: "border-amber-500/35 bg-amber-500/10 text-amber-200",
    hint: "Sporcu kartları toplam borcu ve tüm zaman ödemelerini gösterir.",
  },
  overdue: {
    label: "Gecikmiş",
    tone: "border-red-500/35 bg-red-500/10 text-red-200",
    hint: "Vadesi geçmiş alacak ve borç kayıtları listelenir.",
  },
  new_record: {
    label: "Yeni kayıt",
    tone: "border-cyan-500/35 bg-cyan-500/10 text-cyan-200",
    hint: "Form gönderildiğinde ilgili sekmeler otomatik tazelenir.",
  },
};

type Props = {
  scope: FinanceScopeKind;
  className?: string;
};

export function FinanceScopeChip({ scope, className = "" }: Props) {
  const meta = SCOPE_META[scope];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${meta.tone} ${className}`}
      title={meta.hint}
    >
      {meta.label}
    </span>
  );
}

export function FinanceScopeHint({ scope }: { scope: FinanceScopeKind }) {
  return (
    <p className="text-[11px] font-semibold text-gray-500" role="note">
      {SCOPE_META[scope].hint}
    </p>
  );
}
