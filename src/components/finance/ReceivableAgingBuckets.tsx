"use client";

import { computeReceivableAgingBuckets } from "@/lib/finance/receivableAging";
import type { ReceivablePackageRow } from "@/lib/actions/receivableDashboardActions";
import { formatCurrencyTRY } from "@/lib/privateLessons/packageMath";

type Props = {
  packageRows: ReceivablePackageRow[];
};

export function ReceivableAgingBuckets({ packageRows }: Props) {
  const buckets = computeReceivableAgingBuckets(packageRows);
  const hasOverdue = buckets.some((b) => b.count > 0);

  if (!hasOverdue) {
    return (
      <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] font-semibold text-emerald-200/90">
        Seçili filtrelerde gecikmiş paket bulunmuyor.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#121215] p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Gecikmiş alacak yaşlandırma</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {buckets.map((bucket) => (
          <article
            key={bucket.key}
            className={`rounded-lg border px-3 py-2.5 ${
              bucket.count > 0 ? "border-rose-500/25 bg-rose-500/5" : "border-white/10 bg-black/20 opacity-60"
            }`}
          >
            <p className="text-[9px] font-black uppercase text-gray-400">{bucket.label}</p>
            <p className="mt-0.5 text-base font-black tabular-nums text-rose-200 sm:text-lg">
              {formatCurrencyTRY(bucket.amount)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-500">{bucket.count} paket</p>
          </article>
        ))}
      </div>
    </section>
  );
}
