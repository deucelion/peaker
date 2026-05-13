"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import EmptyStateCard from "@/components/EmptyStateCard";
import Notification from "@/components/Notification";
import { listPrivateLessonPackagesForManagement } from "@/lib/actions/privateLessonPackageActions";
import type { PrivateLessonPackage } from "@/lib/types";
import type { TrainingWorkspaceView } from "../_utils/training";

/**
 * Faz 6.1 — Özel ders çalışma alanı (paket-listesi/planlama/kullanim/tahsilat).
 *
 * Davranış: orijinal `PrivateLessonsWorkspaceView` ile birebir aynı.
 */
export function PrivateLessonsView({
  view,
  packageId,
}: {
  view: TrainingWorkspaceView;
  packageId: string | null;
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PrivateLessonPackage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPrivateLessonPackagesForManagement();
    if ("error" in res) {
      setError(res.error || "Özel ders paketleri alınamadı.");
      setRows([]);
      setLoading(false);
      return;
    }
    setError(null);
    setRows(res.packages || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  const activeRows = useMemo(() => rows.filter((p) => p.isActive), [rows]);
  const doneRows = useMemo(() => rows.filter((p) => !p.isActive), [rows]);

  const usageRows = useMemo(() => {
    return [...rows].sort((a, b) => b.usedLessons - a.usedLessons);
  }, [rows]);

  const paymentRows = useMemo(() => {
    return [...rows].sort((a, b) => (b.totalPrice - b.amountPaid) - (a.totalPrice - a.amountPaid));
  }, [rows]);
  const overdueLikeRows = useMemo(
    () => rows.filter((p) => p.paymentStatus === "partial" || p.paymentStatus === "unpaid").length,
    [rows]
  );
  const selectedPackage = useMemo(() => rows.find((p) => p.id === packageId) || null, [rows, packageId]);
  const planDate = searchParams.get("planDate") || "";
  const planTime = searchParams.get("planTime") || "";
  const hasCalendarPrefill = Boolean(planDate && planTime);
  const detailHrefFor = (pkgId: string) =>
    `/ozel-ders-paketleri/${pkgId}?from=antrenman-yonetimi&returnView=${encodeURIComponent(view || "paket-listesi")}`;

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#121215] px-6 py-16 text-center sm:rounded-[2rem]">
        <Loader2 className="mx-auto mb-4 size-10 animate-spin text-[#7c3aed]" aria-hidden />
        <p className="text-sm font-bold text-gray-400">Özel ders çalışma alanı yükleniyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem]">
        <Notification message={error} variant="error" />
      </div>
    );
  }

  if (selectedPackage) {
    const remainingPayment = Math.max(selectedPackage.totalPrice - selectedPackage.amountPaid, 0);
    const returnHref = `/antrenman-yonetimi?modul=ozel-dersler&view=${encodeURIComponent(
      view || "paket-listesi"
    )}`;
    const detailHref = `/ozel-ders-paketleri/${selectedPackage.id}?from=antrenman-yonetimi&returnView=${encodeURIComponent(
      view || "paket-listesi"
    )}`;
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={returnHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300"
          >
            <ArrowLeft size={14} aria-hidden />
            Listeye dön
          </Link>
          <Link
            href={`${detailHref}${
              hasCalendarPrefill
                ? `&tab=plan&lessonDate=${encodeURIComponent(planDate)}&startClock=${encodeURIComponent(planTime)}`
                : ""
            }`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-3 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
          >
            Paket Detayına Git
          </Link>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <p className="text-lg font-black uppercase text-white">{selectedPackage.athleteName}</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-300">{selectedPackage.packageName}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Kalan Ders</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{selectedPackage.remainingLessons}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Kullanılan / Toplam</p>
              <p className="mt-1 text-[11px] font-semibold text-white">
                {selectedPackage.usedLessons} / {selectedPackage.totalLessons}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Koç</p>
              <p className="mt-1 text-[11px] font-semibold text-white">
                {selectedPackage.coachName || "Koç atanmadı"}
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-amber-200">Kalan Ödeme</p>
              <p className="mt-1 text-[11px] font-semibold text-white">
                ₺{remainingPayment.toLocaleString("tr-TR")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-semibold text-gray-500">
            Bu alan yalnızca özet görünümüdür. Planlama, kullanım, tahsilat ve paket ayarları için paket detay
            ekranını kullanın.
          </p>
        </div>
      </section>
    );
  }

  if (view === "planlama") {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-sm font-black uppercase text-white">Planlama</h2>
        <p className="mt-1 text-[11px] font-semibold text-gray-500">
          Planlama için önce aktif paketi seçin, ardından paket detayından oturumu başlatın.
        </p>
        {hasCalendarPrefill ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-100">
            Takvimden gelen zaman: {planDate} · {planTime}. Aşağıdan bir paket seçip planı bu zamanla
            başlatabilirsiniz.
          </div>
        ) : null}
        <div className="mt-4 grid gap-3">
          {activeRows.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Planlama için aktif özel ders paketi bulunamadı."
              reason="Henüz paket oluşturulmamış veya tüm paketler tamamlanmış olabilir."
              primaryAction={{ label: "Paket oluştur", href: "/ozel-ders-paketleri" }}
              secondaryAction={{
                label: "Paket listesi",
                href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi",
              }}
              compact
            />
          ) : (
            activeRows.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] font-bold text-gray-300"
              >
                <p className="text-white">{pkg.packageName}</p>
                <p className="mt-1 text-gray-500">
                  {pkg.athleteName} · Koç: {pkg.coachName || "—"}
                </p>
                <p className="mt-1 text-gray-500">
                  Kalan ders: {pkg.remainingLessons} / {pkg.totalLessons}
                </p>
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="mt-2 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  if (view === "kullanim") {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-sm font-black uppercase text-white">Kullanım</h2>
        <p className="mt-1 text-[11px] font-semibold text-gray-500">
          Paket kullanım yoğunluğunu ve kalan ders dengesini izleyin.
        </p>
        <div className="mt-4 grid gap-3">
          {usageRows.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Kullanım görünümünde listelenecek paket verisi bulunamadı."
              reason="Özel ders paketi olmadığı için kullanım kaydı oluşmamış olabilir."
              primaryAction={{ label: "Paket oluştur", href: "/ozel-ders-paketleri" }}
              secondaryAction={{
                label: "Paket listesi",
                href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi",
              }}
              compact
            />
          ) : (
            usageRows.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] font-bold text-gray-300"
              >
                <p className="text-white">{pkg.packageName}</p>
                <p className="mt-1 text-gray-500">
                  {pkg.athleteName} · Kullanılan: {pkg.usedLessons}
                </p>
                <p className="mt-1 text-gray-500">
                  Kalan: {pkg.remainingLessons} · Toplam: {pkg.totalLessons}
                </p>
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="mt-2 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  if (view === "tahsilat") {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-sm font-black uppercase text-white">Tahsilat</h2>
        <p className="mt-1 text-[11px] font-semibold text-gray-500">
          Paket bazlı tahsilat durumunu ve kalan bakiyeyi takip edin.
        </p>
        <div className="mt-4 grid gap-3">
          {paymentRows.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Tahsilat görünümünde listelenecek paket kaydı bulunamadı."
              reason="Özel ders paketi olmadığı için tahsilat verisi oluşmamış olabilir."
              primaryAction={{ label: "Paket oluştur", href: "/ozel-ders-paketleri" }}
              secondaryAction={{
                label: "Paket listesi",
                href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi",
              }}
              compact
            />
          ) : (
            paymentRows.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] font-bold text-gray-300"
              >
                <p className="text-white">{pkg.packageName}</p>
                <p className="mt-1 text-gray-500">
                  {pkg.athleteName} · Ödenen: ₺{pkg.amountPaid.toLocaleString("tr-TR")}
                </p>
                <p className="mt-1 text-gray-500">
                  Kalan ödeme: ₺{Math.max(pkg.totalPrice - pkg.amountPaid, 0).toLocaleString("tr-TR")}
                </p>
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="mt-2 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
      <h2 className="text-sm font-black uppercase text-white">Paket Listesi</h2>
      <p className="mt-1 text-[11px] font-semibold text-gray-500">
        Özel ders operasyonu için önce paketi seçin, sonra detaydan işlem yapın.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Toplam Paket</p>
          <p className="mt-1 text-lg font-black text-white">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-emerald-200">Aktif</p>
          <p className="mt-1 text-lg font-black text-white">{activeRows.length}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-amber-200">Tahsilat Bekleyen</p>
          <p className="mt-1 text-lg font-black text-white">{overdueLikeRows}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Tamamlanan</p>
          <p className="mt-1 text-lg font-black text-white">{doneRows.length}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {activeRows.length === 0 && doneRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center">
            <p className="text-[12px] font-bold text-gray-400">Aktif özel ders paketi bulunmuyor.</p>
            <p className="mt-1 text-[11px] font-semibold text-gray-500">
              Operasyona başlamak için önce bir paket oluşturun.
            </p>
            <Link
              href="/ozel-ders-paketleri"
              className="mt-3 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
            >
              Yeni Paket Oluştur
            </Link>
          </div>
        ) : (
          [...activeRows, ...doneRows].map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4 text-[11px] font-bold text-gray-300 transition hover:border-[#7c3aed]/35 hover:bg-[#7c3aed]/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black uppercase text-white">{pkg.athleteName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-300">
                    Kalan Ders: <span className="text-white">{pkg.remainingLessons}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${
                      pkg.isActive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/15 bg-white/5 text-gray-300"
                    }`}
                  >
                    {pkg.isActive ? "Aktif" : "Tamamlandı"}
                  </span>
                  {pkg.isActive && pkg.remainingLessons > 0 && pkg.remainingLessons <= 2 ? (
                    <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">
                      Az Ders
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 grid gap-1 text-[11px] font-semibold text-gray-400">
                <p>
                  {pkg.packageName} ·{" "}
                  <span className="text-gray-200">Koç: {pkg.coachName || "Koç atanmadı"}</span>
                </p>
              </div>

              <div className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Operasyon Özeti</p>
                <div className="mt-1 grid gap-1 text-[11px] font-semibold text-gray-300 sm:grid-cols-2">
                  <p>
                    Kullanılan/Toplam:{" "}
                    <span className="text-white">
                      {pkg.usedLessons}/{pkg.totalLessons}
                    </span>
                  </p>
                  <p>
                    Ödeme:{" "}
                    <span
                      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        pkg.paymentStatus === "paid"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : pkg.paymentStatus === "partial"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {pkg.paymentStatus === "paid"
                        ? "Ödeme Tamamlandı"
                        : pkg.paymentStatus === "partial"
                          ? "Kısmi Ödeme"
                          : "Ödeme Bekleniyor"}
                    </span>
                  </p>
                  <p>
                    Kalan Ödeme:{" "}
                    <span className="text-white">
                      ₺{Math.max(pkg.totalPrice - pkg.amountPaid, 0).toLocaleString("tr-TR")}
                    </span>
                  </p>
                  <p>
                    Yaklaşan Planlı Ders:{" "}
                    <span className="text-gray-200">Paket detayında görüntüleyin</span>
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default PrivateLessonsView;
