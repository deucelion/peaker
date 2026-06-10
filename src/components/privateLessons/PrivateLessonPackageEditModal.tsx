"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { updatePrivateLessonPackage } from "@/lib/actions/privateLessonPackageActions";
import { parseTRYMoneyInput } from "@/lib/privateLessons/packageMath";
import { resolvePackageLifecycleStatus } from "@/lib/privateLessons/packageStatus";
import { MoneyAmountInput } from "@/components/privateLessons/MoneyAmountInput";
import type { PrivateLessonPackage } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  pkg: PrivateLessonPackage;
  coaches: Array<{ id: string; full_name: string }>;
  viewerRole: "admin" | "coach";
};

export function PrivateLessonPackageEditModal({ open, onClose, onSuccess, pkg, coaches, viewerRole }: Props) {
  const [packageName, setPackageName] = useState(pkg.packageName);
  const [coachId, setCoachId] = useState(pkg.coachId || "");
  const [totalLessons, setTotalLessons] = useState(String(pkg.totalLessons));
  const [totalPrice, setTotalPrice] = useState(String(pkg.totalPrice));
  const [isActive, setIsActive] = useState(pkg.isActive);
  const [installmentCount, setInstallmentCount] = useState(pkg.installmentCount != null ? String(pkg.installmentCount) : "");
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState(
    pkg.installmentIntervalDays != null ? String(pkg.installmentIntervalDays) : ""
  );
  const [nextPaymentDueAt, setNextPaymentDueAt] = useState(
    pkg.nextPaymentDueAt ? pkg.nextPaymentDueAt.slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const lessons = Math.floor(Number(totalLessons));
    const price = parseTRYMoneyInput(totalPrice);
    return { lessons, price };
  }, [totalLessons, totalPrice]);

  const currentLifecycle = useMemo(() => resolvePackageLifecycleStatus(pkg), [pkg]);
  /** Tamamlanmış pakete ders eklenirse (pazarlık/hediye) paket otomatik yeniden aktifleşir. */
  const willReactivate =
    currentLifecycle === "completed" &&
    Number.isFinite(parsed.lessons) &&
    parsed.lessons > pkg.usedLessons;

  const isValid =
    Boolean(packageName.trim()) &&
    Number.isFinite(parsed.lessons) &&
    parsed.lessons >= pkg.usedLessons &&
    parsed.price != null &&
    parsed.price >= pkg.amountPaid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError("Toplam ders kullanılan ders sayısından küçük olamaz; ücret ödenen tutardan düşük olamaz.");
      return;
    }
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("packageId", pkg.id);
    fd.append("packageName", packageName.trim());
    fd.append("coachId", coachId);
    fd.append("totalLessons", totalLessons);
    fd.append("totalPrice", totalPrice);
    fd.append("isActive", willReactivate || isActive ? "true" : "false");
    if (installmentCount) fd.append("installmentCount", installmentCount);
    if (installmentIntervalDays) fd.append("installmentIntervalDays", installmentIntervalDays);
    if (nextPaymentDueAt) fd.append("nextPaymentDueAt", nextPaymentDueAt);
    const res = await updatePrivateLessonPackage(fd);
    if ("success" in res && res.success) {
      onSuccess?.();
      onClose();
    } else {
      setError(("error" in res && res.error) || "Paket güncellenemedi.");
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Kapat" onClick={() => !saving && onClose()} />
      <form onSubmit={(e) => void handleSubmit(e)} className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#121215] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Paketi düzenle</h2>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-white">
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-[10px] font-semibold text-amber-300/90">
          Ödenen tutar (₺{pkg.amountPaid}) manuel değiştirilmez. Toplam ücret ve ders sayısı finansal kurallara göre sınırlanır.
        </p>
        {willReactivate ? (
          <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-200">
            Ders eklediğiniz için tamamlanmış paket kaydedildiğinde otomatik olarak yeniden aktifleşecek; yeni ders planlanabilir.
          </p>
        ) : null}
        <div className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paket adı</span>
            <input
              className="min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 text-sm font-bold text-white"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Koç</span>
            <select
              className="min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 text-sm font-bold text-white"
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
              disabled={viewerRole === "coach"}
            >
              <option value="">Koç yok</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Toplam ders (kullanılan: {pkg.usedLessons})
            </span>
            <input
              type="number"
              min={pkg.usedLessons}
              className="min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 text-sm font-bold text-white"
              value={totalLessons}
              onChange={(e) => setTotalLessons(e.target.value)}
              required
            />
          </label>
          <MoneyAmountInput
            label={`Toplam ücret (min ${pkg.amountPaid} ₺)`}
            required
            value={totalPrice}
            onChange={setTotalPrice}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Taksit sayısı</span>
              <input
                type="number"
                min={1}
                className="min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 text-sm font-bold text-white"
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aralık (gün)</span>
              <input
                type="number"
                min={1}
                className="min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 text-sm font-bold text-white"
                value={installmentIntervalDays}
                onChange={(e) => setInstallmentIntervalDays(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sonraki vade</span>
              <input
                type="datetime-local"
                className="min-h-[3rem] w-full rounded-2xl border border-white/10 bg-[#0d0d11] px-4 text-sm font-bold text-white"
                value={nextPaymentDueAt}
                onChange={(e) => setNextPaymentDueAt(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-gray-300">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Paket aktif
          </label>
          {error ? <p className="text-[11px] font-bold text-red-300">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase text-gray-300">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || !isValid}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}
