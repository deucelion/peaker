"use client";

import { useMemo, useState } from "react";
import { Loader2, Package, X } from "lucide-react";
import { createPrivateLessonPackage } from "@/lib/actions/privateLessonPackageActions";
import { parseTRYMoneyInput } from "@/lib/privateLessons/packageMath";
import { MoneyAmountInput } from "@/components/privateLessons/MoneyAmountInput";
import { OverlayDialog, OverlayFooter, OVERLAY_Z } from "@/components/ui/overlay";

export type PrivateLessonPackageFormValues = {
  athleteId: string;
  coachId: string;
  packageType: string;
  packageName: string;
  totalLessons: string;
  totalPrice: string;
  amountPaid: string;
  installmentCount: string;
  installmentIntervalDays: string;
  nextPaymentDueAt: string;
};

const DEFAULT_VALUES: PrivateLessonPackageFormValues = {
  athleteId: "",
  coachId: "",
  packageType: "private",
  packageName: "",
  totalLessons: "8",
  totalPrice: "",
  amountPaid: "0",
  installmentCount: "",
  installmentIntervalDays: "",
  nextPaymentDueAt: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (packageId: string) => void;
  athletes: Array<{ id: string; full_name: string }>;
  coaches: Array<{ id: string; full_name: string }>;
  viewerRole: "admin" | "coach";
  viewerId: string;
  /** Sporcu detayından açıldığında sporcu seçimi kilitli */
  lockedAthleteId?: string;
  lockedAthleteName?: string;
};

export function PrivateLessonPackageFormModal({
  open,
  onClose,
  onSuccess,
  athletes,
  coaches,
  viewerRole,
  viewerId,
  lockedAthleteId,
  lockedAthleteName,
}: Props) {
  const [form, setForm] = useState<PrivateLessonPackageFormValues>(() => ({
    ...DEFAULT_VALUES,
    athleteId: lockedAthleteId || "",
    coachId: viewerRole === "coach" ? viewerId : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const totalLessons = Math.floor(Number(form.totalLessons));
    const totalPrice = parseTRYMoneyInput(form.totalPrice);
    const amountPaid = parseTRYMoneyInput(form.amountPaid) ?? 0;
    return { totalLessons, totalPrice, amountPaid };
  }, [form]);

  const isValid =
    Boolean(form.athleteId) &&
    Boolean(form.packageName.trim()) &&
    Number.isFinite(parsed.totalLessons) &&
    parsed.totalLessons > 0 &&
    parsed.totalPrice != null &&
    parsed.totalPrice > 0 &&
    parsed.amountPaid >= 0 &&
    parsed.amountPaid <= (parsed.totalPrice ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError("Formu kontrol edin: sporcu, paket adı, ders sayısı ve ücret zorunludur.");
      return;
    }
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("athleteId", form.athleteId);
    fd.append("coachId", form.coachId);
    fd.append("packageType", form.packageType);
    fd.append("packageName", form.packageName.trim());
    fd.append("totalLessons", form.totalLessons);
    fd.append("totalPrice", form.totalPrice);
    fd.append("amountPaid", form.amountPaid || "0");
    if (form.installmentCount) fd.append("installmentCount", form.installmentCount);
    if (form.installmentIntervalDays) fd.append("installmentIntervalDays", form.installmentIntervalDays);
    if (form.nextPaymentDueAt) fd.append("nextPaymentDueAt", form.nextPaymentDueAt);
    const res = await createPrivateLessonPackage(fd);
    if ("success" in res && res.success) {
      const id = "packageId" in res ? res.packageId || "" : "";
      onSuccess?.(id);
      onClose();
    } else {
      setError(("error" in res && res.error) || "Paket oluşturulamadı.");
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <OverlayDialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      layer={OVERLAY_Z.DIALOG}
      shellClassName="relative w-full max-w-lg rounded-2xl ui-card p-5 shadow-xl !max-w-lg"
    >
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ui-kpi-chip--brand ui-kpi-card__trend ring-1 ring-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,transparent)]">
              <Package size={22} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Yeni özel ders paketi</h2>
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                Paket oluşturduktan sonra ders planlayabilir ve ödeme takip edebilirsiniz.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 hover:text-white"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {lockedAthleteId ? (
            <div className="rounded-xl ui-kpi-band px-3 py-2 text-[11px] font-bold text-gray-300">
              Sporcu: <span className="text-white">{lockedAthleteName || "Seçili sporcu"}</span>
            </div>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sporcu *</span>
              <select
                className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
                value={form.athleteId}
                onChange={(e) => setForm((p) => ({ ...p, athleteId: e.target.value }))}
                required
              >
                <option value="">Sporcu seçin</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Koç</span>
            <select
              className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
              value={form.coachId}
              onChange={(e) => setForm((p) => ({ ...p, coachId: e.target.value }))}
              disabled={viewerRole === "coach"}
            >
              <option value="">Koç seçilmedi</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paket adı *</span>
            <input
              className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
              value={form.packageName}
              onChange={(e) => setForm((p) => ({ ...p, packageName: e.target.value }))}
              placeholder="Örn: 8'li özel ders"
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Toplam ders *</span>
            <input
              type="number"
              min={1}
              className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
              value={form.totalLessons}
              onChange={(e) => setForm((p) => ({ ...p, totalLessons: e.target.value }))}
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyAmountInput
              label="Toplam ücret"
              required
              value={form.totalPrice}
              onChange={(v) => setForm((p) => ({ ...p, totalPrice: v }))}
            />
            <MoneyAmountInput
              label="İlk ödeme (opsiyonel)"
              value={form.amountPaid}
              onChange={(v) => setForm((p) => ({ ...p, amountPaid: v }))}
              hint="Boş veya 0 bırakılabilir"
              placeholder="0"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3 border-t border-white/5 pt-4">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Taksit sayısı</span>
              <input
                type="number"
                min={1}
                className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
                value={form.installmentCount}
                onChange={(e) => setForm((p) => ({ ...p, installmentCount: e.target.value }))}
                placeholder="Opsiyonel"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aralık (gün)</span>
              <input
                type="number"
                min={1}
                className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
                value={form.installmentIntervalDays}
                onChange={(e) => setForm((p) => ({ ...p, installmentIntervalDays: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sonraki vade</span>
              <input
                type="datetime-local"
                className="min-h-[3rem] w-full rounded-2xl px-4 text-sm font-bold text-white"
                value={form.nextPaymentDueAt}
                onChange={(e) => setForm((p) => ({ ...p, nextPaymentDueAt: e.target.value }))}
              />
            </label>
          </div>

          {error ? <p className="text-[11px] font-bold text-red-300">{error}</p> : null}
        </div>

        <OverlayFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-[10px] font-black uppercase text-gray-300"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || !isValid}
            className="inline-flex items-center gap-2 rounded-xl ui-btn-primary px-4 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Paketi kaydet
          </button>
        </OverlayFooter>
      </form>
    </OverlayDialog>
  );
}
