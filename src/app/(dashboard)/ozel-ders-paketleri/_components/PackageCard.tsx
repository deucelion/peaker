"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { PrivateLessonPackage } from "@/lib/types";

function paymentLabel(s: PrivateLessonPackage["paymentStatus"]): string {
  if (s === "paid") return "Ödendi";
  if (s === "partial") return "Kısmi ödeme";
  return "Ödenmedi";
}

function paymentToneClasses(s: PrivateLessonPackage["paymentStatus"]): string {
  if (s === "paid") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (s === "partial") return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  return "border-rose-500/35 bg-rose-500/10 text-rose-200";
}

function packageTypeLabel(t: string): string {
  if (t === "private") return "Özel (1:1)";
  if (t === "duet") return "Düet";
  if (t === "elite") return "Elite 1:1";
  return t;
}

export function PackageCard({ pkg }: { pkg: PrivateLessonPackage }) {
  const href = `/ozel-ders-paketleri/${pkg.id}`;
  const blocked = !pkg.isActive || pkg.remainingLessons <= 0;
  const low = pkg.isActive && pkg.remainingLessons > 0 && pkg.remainingLessons < 3;
  const remainingPay = Math.max(Number(pkg.totalPrice) - Number(pkg.amountPaid), 0);

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl ui-card shadow-[0_12px_40px_-16px_rgba(0,0,0,0.85)] transition duration-200 sm:rounded-[1.35rem] sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)] sm:hover:shadow-[0_20px_50px_-20px_color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,transparent)]">
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-2xl sm:rounded-[1.35rem]"
        aria-label={`${pkg.packageName} — paket detayını aç`}
      />
      <div className="pointer-events-none relative z-10 flex flex-col gap-5 p-5 sm:gap-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2 pr-8 sm:pr-0">
            <h3 className="text-lg font-black italic uppercase leading-tight tracking-tight text-white sm:text-xl">
              {pkg.packageName}
            </h3>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {pkg.athleteName}
              <span className="mx-2 text-white/15">·</span>
              {packageTypeLabel(pkg.packageType)}
              <span className="mx-2 text-white/15">·</span>
              Koç: {pkg.coachName || "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {low ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-amber-200">
                <AlertTriangle size={14} aria-hidden />
                Az ders: {pkg.remainingLessons}
              </span>
            ) : null}
            {blocked && pkg.usedLessons > 0 ? (
              <span className="rounded-xl ui-btn-ghost px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400">
                Kullanım kapalı
              </span>
            ) : null}
            <span
              className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${paymentToneClasses(pkg.paymentStatus)}`}
            >
              {paymentLabel(pkg.paymentStatus)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border ui-kpi-chip--brand px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-wider ui-kpi-card__trend">Kalan ders</p>
            <p className="mt-1 text-xl font-black tabular-nums text-white">{pkg.remainingLessons}</p>
          </div>
          <div className="rounded-xl ui-kpi-band px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Ders (toplam / yapılan)</p>
            <p className="mt-1 text-xl font-black tabular-nums text-white">
              {pkg.totalLessons}
              <span className="mx-1 text-gray-600">/</span>
              {pkg.usedLessons}
            </p>
          </div>
          <div className="rounded-xl ui-kpi-band px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Toplam ücret</p>
            <p className="mt-1 text-lg font-black tabular-nums text-white">₺{pkg.totalPrice}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-rose-200/80">Kalan ödeme</p>
            <p className="mt-1 text-lg font-black tabular-nums text-rose-100">₺{remainingPay}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] ui-kpi-card__trend">Paketi yönet</span>
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-500 transition group-hover:text-white">
            Detay
            <ChevronRight size={16} className="text-[color:var(--peaker-ui-PRIMARY)] transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
