"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { getPrivateLessonPackageDetail } from "@/lib/actions/privateLessonPackageActions";
import type { PrivateLessonPackageDetailSnapshot } from "@/lib/types";

function paymentLabel(status: "unpaid" | "partial" | "paid"): string {
  if (status === "paid") return "Odendi";
  if (status === "partial") return "Kismi odeme";
  return "Odenmedi";
}

export default function PrivateLessonPackageDetailPage() {
  const params = useParams();
  const packageId = typeof params.packageId === "string" ? params.packageId : params.packageId?.[0] || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrivateLessonPackageDetailSnapshot | null>(null);

  const loadDetail = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    setError(null);
    const res = await getPrivateLessonPackageDetail(packageId);
    if ("error" in res) {
      setError(res.error);
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setSnapshot(res);
    setLoading(false);
  }, [packageId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => clearTimeout(id);
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-gray-500 font-black italic uppercase text-[10px] tracking-wide sm:tracking-widest break-words max-w-md">
          Ozel ders paketi yukleniyor...
        </p>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="space-y-4 min-w-0">
        <Link href="/ozel-ders-paketleri" className="inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-wide text-[#7c3aed] touch-manipulation">
          Ozel ders paketleri
        </Link>
        <Notification message={error || "Paket bulunamadi."} variant="error" />
      </div>
    );
  }

  const pkg = snapshot.package;
  const remainingBalance = Math.max(pkg.totalPrice - pkg.amountPaid, 0);

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <Link href="/ozel-ders-paketleri" className="inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-wide text-[#7c3aed] touch-manipulation">
        Ozel ders paketleri
      </Link>

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black italic uppercase text-white break-words">{pkg.packageName}</h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase mt-2 break-words">
          {pkg.packageType} • Sporcu: {pkg.athleteName} • Koc: {pkg.coachName || "-"}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[10px] font-black uppercase">
          <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Toplam ucret: ₺{pkg.totalPrice}</span>
          <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Odenen: ₺{pkg.amountPaid}</span>
          <span className="px-3 py-2 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 text-[#c4b5fd]">Kalan bakiye: ₺{remainingBalance}</span>
          <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Durum: {paymentLabel(pkg.paymentStatus)}</span>
          <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Toplam ders: {pkg.totalLessons}</span>
          <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Kullanilan: {pkg.usedLessons}</span>
          <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Kalan ders: {pkg.remainingLessons}</span>
        </div>
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 min-w-0">
        <h2 className="text-sm font-black italic uppercase text-white">Kullanim gecmisi</h2>
        {snapshot.usageRows.length === 0 ? (
          <p className="mt-3 text-[10px] text-gray-500 font-black uppercase">Kayitli kullanim yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {snapshot.usageRows.map((row) => (
              <li key={row.id} className="border border-white/10 rounded-xl px-3 py-2 text-[10px] text-gray-300 font-bold break-words">
                {new Date(row.usedAt).toLocaleString("tr-TR")}
                {row.note ? ` — ${row.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 min-w-0">
        <h2 className="text-sm font-black italic uppercase text-white">Odeme gecmisi</h2>
        {snapshot.paymentRows.length === 0 ? (
          <p className="mt-3 text-[10px] text-gray-500 font-black uppercase">Kayitli odeme yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {snapshot.paymentRows.map((row) => (
              <li key={row.id} className="border border-white/10 rounded-xl px-3 py-2 text-[10px] text-gray-300 font-bold break-words">
                {new Date(row.paidAt).toLocaleString("tr-TR")} — ₺{row.amount}
                {row.note ? ` — ${row.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
