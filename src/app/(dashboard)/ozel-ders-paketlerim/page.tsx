"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Notification from "@/components/Notification";
import { listPrivateLessonPackagesForAthlete } from "@/lib/actions/privateLessonPackageActions";
import { listPrivateLessonSessionsForAthlete } from "@/lib/actions/privateLessonSessionActions";
import type { PrivateLessonPackage, PrivateLessonSessionListItem } from "@/lib/types";
import { formatLessonDateTimeTr } from "@/lib/forms/datetimeLocal";

export default function PrivateLessonPackagesAthletePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PrivateLessonPackage[]>([]);
  const [sessions, setSessions] = useState<PrivateLessonSessionListItem[]>([]);
  const activeItems = useMemo(() => items.filter((pkg) => pkg.isActive), [items]);
  const totalRemainingLessons = useMemo(
    () => activeItems.reduce((sum, pkg) => sum + Math.max(pkg.remainingLessons, 0), 0),
    [activeItems]
  );
  const totalLessons = useMemo(
    () => activeItems.reduce((sum, pkg) => sum + Math.max(pkg.totalLessons, 0), 0),
    [activeItems]
  );
  const totalUsedLessons = useMemo(
    () => activeItems.reduce((sum, pkg) => sum + Math.max(pkg.usedLessons, 0), 0),
    [activeItems]
  );
  const totalPaid = useMemo(
    () => activeItems.reduce((sum, pkg) => sum + Number(pkg.amountPaid || 0), 0),
    [activeItems]
  );
  const totalPrice = useMemo(
    () => activeItems.reduce((sum, pkg) => sum + Number(pkg.totalPrice || 0), 0),
    [activeItems]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [res, sesRes] = await Promise.all([
      listPrivateLessonPackagesForAthlete(),
      listPrivateLessonSessionsForAthlete(),
    ]);
    if ("error" in res) {
      setError(res.error);
      setItems([]);
      setSessions([]);
      setLoading(false);
      return;
    }
    setItems(res.packages);
    if ("sessions" in sesRes) {
      setSessions(sesRes.sessions);
    } else {
      setSessions([]);
    }
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
          ÖZEL DERSLER <span className="text-[#7c3aed]">· PAKETLERİM</span>
        </h1>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Kalan ders, tahsilat ve sonraki adım özeti
        </p>
      </header>

      {error && (
        <div className="min-w-0 break-words">
          <Notification message={error} variant="error" />
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-[#121215] min-w-0">
          <p className="text-[10px] text-gray-500 font-black uppercase break-words">Aktif veya geçmiş paket bulunmuyor.</p>
          <p className="mt-2 text-[10px] font-bold text-gray-400">Paket tanımı için koçunuz veya yöneticinizle iletişime geçin.</p>
        </div>
      )}

      {!error && sessions.length > 0 && (
        <section className="rounded-2xl border border-[#7c3aed]/25 bg-[#121215] p-4 sm:p-5">
          <h2 className="text-sm font-black italic uppercase text-white">Takvim ve planlar</h2>
          <p className="mt-1 text-[10px] font-bold text-gray-500">
            Yaklaşan ve geçmiş planlar (grup dersi değildir). Detay için pakete girin.
          </p>
          <ul className="mt-4 space-y-2">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/ozel-ders-paketleri/${s.packageId}`}
                  className="block rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-bold text-gray-300 touch-manipulation sm:hover:border-[#7c3aed]/30"
                >
                  <span className="text-white">{formatLessonDateTimeTr(s.startsAt)}</span>
                  <span className="mx-2 text-gray-600">·</span>
                  <span className="text-gray-400">{s.packageName || "Paket"}</span>
                  <span className="mx-2 text-gray-600">·</span>
                  <span className="text-[#c4b5fd]">{s.coachName || "Koç"}</span>
                  {s.location ? (
                    <>
                      <span className="mx-2 text-gray-600">·</span>
                      <span className="text-gray-500">{s.location}</span>
                    </>
                  ) : null}
                  <span className="mt-1 block text-[10px] uppercase text-gray-600">
                    {s.status === "planned" ? "Planlandı" : s.status === "completed" ? "Tamamlandı" : "İptal edildi"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!error && items.length > 0 && (
        <div className="space-y-4 min-w-0">
          <section className="rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5">
            <h2 className="text-sm font-black italic uppercase text-white">Özet</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 text-[10px] font-black uppercase">
              <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Aktif paket: {activeItems.length}</span>
              <span className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-3 py-2 text-[#c4b5fd]">Kalan ders: {totalRemainingLessons}</span>
              <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Toplam / yapılan: {totalLessons} / {totalUsedLessons}</span>
              <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300">Ödenen: ₺{totalPaid}</span>
              <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">Kalan ödeme: ₺{Math.max(totalPrice - totalPaid, 0)}</span>
            </div>
            <p className="mt-2 text-[10px] font-bold text-gray-400">Öncelik: Kalan dersi azalan paketleri ve bakiye ödemeyi takip edin.</p>
          </section>
          <div className="grid gap-3 min-w-0">
          {items.map((pkg) => {
            const low = pkg.isActive && pkg.remainingLessons > 0 && pkg.remainingLessons < 3;
            const pay =
              pkg.paymentStatus === "paid" ? "Ödendi" : pkg.paymentStatus === "partial" ? "Kısmi ödeme" : "Ödenmedi";
            const paymentClass =
              pkg.paymentStatus === "paid"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : pkg.paymentStatus === "partial"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300";
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
                <span className="px-3 py-2 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 text-[#c4b5fd]">Kalan Ders: {pkg.remainingLessons}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Toplam Ders: {pkg.totalLessons}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Yapılan Ders: {pkg.usedLessons}</span>
                <span className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">Toplam Ücret: ₺{pkg.totalPrice}</span>
                <span className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Ödenen: ₺{pkg.amountPaid}</span>
                <span className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">Kalan Ödeme: ₺{Math.max(Number(pkg.totalPrice) - Number(pkg.amountPaid), 0)}</span>
                <span className={`px-3 py-2 rounded-xl border ${paymentClass}`}>Ödeme Durumu: {pay}</span>
              </div>
              <p className="mt-3 text-[10px] font-bold text-gray-400">
                Sonraki adım: {pkg.isActive && pkg.remainingLessons > 0 ? "Ders planına göre kullanım takibini sürdürün." : "Yeni paket için yöneticinizle iletişime geçin."}
              </p>
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
        </div>
      )}
    </div>
  );
}
