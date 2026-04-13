"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Notification from "@/components/Notification";
import { listPrivateLessonPackagesForAthlete } from "@/lib/actions/privateLessonPackageActions";
import type { PrivateLessonPackage } from "@/lib/types";

export default function PrivateLessonPackagesAthletePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PrivateLessonPackage[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listPrivateLessonPackagesForAthlete();
    if ("error" in res) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setItems(res.packages);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(id);
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-gray-500 font-black italic uppercase text-[10px] tracking-wide sm:tracking-widest break-words max-w-md">
          Paketler yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
          ÖZEL DERS <span className="text-[#7c3aed]">PAKETLERİM</span>
        </h1>
      </header>

      {error && (
        <div className="min-w-0 break-words">
          <Notification message={error} variant="error" />
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-[#121215] min-w-0">
          <p className="text-[10px] text-gray-500 font-black uppercase break-words">Aktif veya geçmiş paket bulunmuyor.</p>
        </div>
      )}

      {!error && items.length > 0 && (
        <div className="grid gap-3 min-w-0">
          {items.map((pkg) => {
            const low = pkg.isActive && pkg.remainingLessons > 0 && pkg.remainingLessons < 3;
            const pay =
              pkg.paymentStatus === "paid" ? "Ödendi" : pkg.paymentStatus === "partial" ? "Kısmi ödeme" : "Ödenmedi";
            return (
            <div key={pkg.id} className="border border-white/10 rounded-2xl bg-[#121215] p-4 sm:p-5 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-black italic uppercase break-words">{pkg.packageName}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 break-words">{pkg.packageType}</p>
                </div>
                {low && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-200 text-[9px] font-black uppercase">
                    <AlertTriangle size={12} aria-hidden /> Kalan ders az ({pkg.remainingLessons})
                  </span>
                )}
              </div>
              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[10px] font-black uppercase">
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Toplam Ders: {pkg.totalLessons}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Yapılan Ders: {pkg.usedLessons}</span>
                <span className="px-3 py-2 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 text-[#c4b5fd]">Kalan Ders: {pkg.remainingLessons}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Toplam Ücret: ₺{pkg.totalPrice}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Ödenen: ₺{pkg.amountPaid}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Ödeme: {pay}</span>
              </div>
              {(!pkg.isActive || pkg.remainingLessons <= 0) && pkg.usedLessons > 0 && (
                <p className="mt-4 text-[10px] text-gray-500 font-bold uppercase break-words">
                  Bu paket tamamlandı. Yenileme için yöneticinizle iletişime geçin veya{" "}
                  <Link href="/bildirimler" className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]">
                    bildirimlerinizi
                  </Link>{" "}
                  kontrol edin.
                </p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
