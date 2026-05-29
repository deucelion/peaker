"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  createAccountingPayment,
  listPrivateLessonPackagesForAccounting,
  type AccountingFinancePackageOption,
} from "@/lib/actions/accountingFinanceActions";
import { normalizeMoney, parseMoneyInput } from "@/lib/privateLessons/packageMath";
import { PATHS } from "@/lib/navigation/routeRegistry";
import {
  formatAccountingPackageOptionLabel,
  PACKAGE_FETCH_TIMEOUT_MS,
  PAYMENT_SUBMIT_TIMEOUT_MS,
  withAsyncTimeout,
} from "@/lib/finance/accountingPackageOptions";

const PAYMENT_KIND_FORM_OPTIONS = [
  { value: "monthly_membership", label: "Aylık Üyelik" },
  { value: "private_lesson_package", label: "Özel Ders Paketi" },
  { value: "extra_charge", label: "Özelleştirilebilir tahsilat" },
] as const;

function defaultFormState() {
  return {
    profileId: "",
    amount: "",
    paymentKind: "monthly_membership",
    extraPaymentKind: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    description: "",
    packageId: "",
  };
}

export type CollectionPaymentFormProps = {
  organizationIdFromUrl: string | null;
  athletes: { id: string; full_name: string }[];
  /** Modal her açılışında artırın; form sıfırlanır ve `initialPrefill` uygulanır. */
  resetKey: number;
  initialPrefill?: {
    profileId?: string;
    packageId?: string;
    paymentKind?: string;
  };
  layout: "modal" | "page";
  onSuccess: () => void | Promise<void>;
  onError?: (message: string) => void;
  /** Modal üst çubuğunda kapatmayı kilitlemek için */
  onBusyChange?: (busy: boolean) => void;
  onCancel?: () => void;
};

export function CollectionPaymentForm({
  organizationIdFromUrl,
  athletes,
  resetKey,
  initialPrefill,
  layout,
  onSuccess,
  onError,
  onBusyChange,
  onCancel,
}: CollectionPaymentFormProps) {
  const router = useRouter();
  const [paymentForm, setPaymentForm] = useState(defaultFormState);
  const [packageOptions, setPackageOptions] = useState<AccountingFinancePackageOption[]>([]);
  const [packageOptionsLoading, setPackageOptionsLoading] = useState(false);
  const [packageOptionsError, setPackageOptionsError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const paymentSubmitInFlightRef = useRef(false);
  const packageFetchGenRef = useRef(0);

  useEffect(() => {
    onBusyChange?.(paymentSubmitting);
  }, [paymentSubmitting, onBusyChange]);

  useEffect(() => {
    const base = defaultFormState();
    const tur = (initialPrefill?.paymentKind || "").trim();
    const kindOk =
      tur === "monthly_membership" || tur === "private_lesson_package" || tur === "extra_charge" ? tur : null;
    setPaymentForm({
      ...base,
      profileId: (initialPrefill?.profileId || "").trim(),
      packageId: (initialPrefill?.packageId || "").trim(),
      paymentKind: kindOk || "monthly_membership",
    });
  }, [resetKey, initialPrefill?.profileId, initialPrefill?.packageId, initialPrefill?.paymentKind]);

  const fetchPackagesForAthlete = useCallback(
    async (athleteId: string) =>
      listPrivateLessonPackagesForAccounting({
        athleteId,
        organizationId: organizationIdFromUrl,
      }),
    [organizationIdFromUrl]
  );

  const loadPackageOptions = useCallback(async () => {
    if (paymentForm.paymentKind !== "private_lesson_package" || !paymentForm.profileId) {
      setPackageOptions([]);
      setPackageOptionsError(null);
      setPackageOptionsLoading(false);
      return;
    }
    const gen = ++packageFetchGenRef.current;
    setPackageOptionsLoading(true);
    setPackageOptionsError(null);
    try {
      const request = () =>
        withAsyncTimeout(
          fetchPackagesForAthlete(paymentForm.profileId),
          PACKAGE_FETCH_TIMEOUT_MS,
          "Paket listesi zaman aşımına uğradı."
        );
      let res;
      try {
        res = await request();
      } catch (firstErr) {
        if (
          firstErr instanceof Error &&
          firstErr.message.includes("zaman aşımı") &&
          gen === packageFetchGenRef.current
        ) {
          res = await request();
        } else {
          throw firstErr;
        }
      }
      if (gen !== packageFetchGenRef.current) return;
      if ("error" in res) {
        setPackageOptions([]);
        setPackageOptionsError(res.error || "Paketler şu anda alınamadı.");
        return;
      }
      setPackageOptions(res.packages);
      if (res.packages.length === 1) {
        setPaymentForm((prev) => ({
          ...prev,
          packageId: prev.packageId || res.packages[0]!.id,
        }));
      }
    } catch (err) {
      if (gen !== packageFetchGenRef.current) return;
      const msg =
        err instanceof Error && err.message.includes("zaman aşımı")
          ? "İşlem zaman aşımına uğradı. Tekrar deneyin."
          : "Paketler şu anda alınamadı. Tekrar deneyin.";
      setPackageOptions([]);
      setPackageOptionsError(msg);
      if (process.env.NODE_ENV !== "production") {
        console.error("[collection-payment packages]", err);
      }
    } finally {
      if (gen === packageFetchGenRef.current) {
        setPackageOptionsLoading(false);
      }
    }
  }, [paymentForm.paymentKind, paymentForm.profileId, fetchPackagesForAthlete]);

  useEffect(() => {
    void loadPackageOptions();
  }, [loadPackageOptions]);

  const paymentAmountValue = parseMoneyInput(paymentForm.amount) ?? Number.NaN;
  const packageKindRequiresSelection = paymentForm.paymentKind === "private_lesson_package";
  const extraKindRequired = paymentForm.paymentKind === "extra_charge";
  const paymentSubmitDisabled =
    paymentSubmitting ||
    packageOptionsLoading ||
    !paymentForm.profileId ||
    !Number.isFinite(paymentAmountValue) ||
    paymentAmountValue <= 0 ||
    !paymentForm.paymentDate ||
    (packageKindRequiresSelection && !paymentForm.packageId) ||
    (extraKindRequired && !paymentForm.extraPaymentKind.trim());

  const handlePaymentSubmit = useCallback(async () => {
    if (paymentSubmitInFlightRef.current) return;
    if (
      !paymentForm.profileId ||
      !Number.isFinite(paymentAmountValue) ||
      paymentAmountValue <= 0 ||
      !paymentForm.paymentDate ||
      (packageKindRequiresSelection && !paymentForm.packageId) ||
      (extraKindRequired && !paymentForm.extraPaymentKind.trim())
    ) {
      return;
    }
    paymentSubmitInFlightRef.current = true;
    setPaymentSubmitting(true);
    setPaymentSubmitError(null);
    try {
      const fd = new FormData();
      fd.set("organizationId", organizationIdFromUrl || "");
      fd.set("profileId", paymentForm.profileId);
      fd.set("amount", paymentForm.amount);
      fd.set(
        "paymentKind",
        paymentForm.paymentKind === "extra_charge" ? paymentForm.extraPaymentKind : paymentForm.paymentKind
      );
      fd.set("paymentDate", paymentForm.paymentDate);
      fd.set("description", paymentForm.description);
      if (paymentForm.paymentKind === "private_lesson_package" && paymentForm.packageId) {
        fd.set("packageId", paymentForm.packageId);
      }
      const selectedPkg =
        paymentForm.paymentKind === "private_lesson_package"
          ? packageOptions.find((p) => p.id === paymentForm.packageId)
          : null;
      if (selectedPkg) {
        const remaining =
          selectedPkg.remainingBalance ?? normalizeMoney(selectedPkg.totalPrice - selectedPkg.amountPaid);
        if (remaining > 0.001 && paymentAmountValue > remaining + 0.001) {
          const msg = "Girilen tutar kalan bakiyeden yüksek olamaz.";
          setPaymentSubmitError(msg);
          onError?.(msg);
          return;
        }
      }
      const res = await withAsyncTimeout(
        createAccountingPayment(fd),
        PAYMENT_SUBMIT_TIMEOUT_MS,
        "Tahsilat kaydı zaman aşımına uğradı."
      );
      if ("error" in res) {
        const msg = res.error || "Tahsilat kaydı oluşturulamadı.";
        setPaymentSubmitError(msg);
        onError?.(msg);
        if (process.env.NODE_ENV !== "production") {
          console.error("[collection-payment submit]", res);
        }
        return;
      }
      await onSuccess();
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("zaman aşımı")
          ? "İşlem zaman aşımına uğradı. Tekrar deneyin."
          : "Tahsilat kaydı oluşturulamadı. Tekrar deneyin.";
      setPaymentSubmitError(msg);
      onError?.(msg);
      if (process.env.NODE_ENV !== "production") {
        console.error("[collection-payment submit]", err);
      }
    } finally {
      paymentSubmitInFlightRef.current = false;
      setPaymentSubmitting(false);
    }
  }, [
    packageOptions,
    organizationIdFromUrl,
    paymentForm,
    onSuccess,
    packageKindRequiresSelection,
    extraKindRequired,
    paymentAmountValue,
    onError,
  ]);

  return (
    <div className="space-y-5">
      {layout === "page" ? (
        <p className="text-[11px] font-semibold text-gray-500">
          Kayıtlar <span className="text-gray-300">Muhasebe &amp; Finans</span> tahsilat listesi ile aynıdır. Özet ve
          raporlar için{" "}
          <Link href={PATHS.muhasebeFinans} className="text-emerald-400 underline-offset-2 hover:underline">
            panele dönün
          </Link>
          .
        </p>
      ) : null}
      <fieldset
        disabled={paymentSubmitting}
        className="min-w-0 space-y-5 border-0 p-0 disabled:pointer-events-none disabled:opacity-55"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[10px] font-black uppercase text-gray-500">Sporcu</span>
            <select
              className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
              value={paymentForm.profileId}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, profileId: e.target.value, packageId: "" }))}
            >
              <option value="">Sporcu seçin</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-gray-500">Tutar (₺)</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                ₺
              </span>
              <input
                type="number"
                min={0}
                className="ui-input min-h-11 w-full pl-8"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-gray-500">Ödeme tarihi</span>
            <input
              type="date"
              className="ui-input min-h-11 w-full"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[10px] font-black uppercase text-gray-500">Ödeme türü</span>
            <select
              className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
              value={paymentForm.paymentKind}
              onChange={(e) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  paymentKind: e.target.value,
                  packageId: "",
                }))
              }
            >
              {PAYMENT_KIND_FORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {paymentForm.paymentKind === "extra_charge" ? (
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[10px] font-black uppercase text-gray-500">Tahsilat adı</span>
                    <input
                      className="ui-input min-h-11 w-full"
                      value={paymentForm.extraPaymentKind}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, extraPaymentKind: e.target.value }))}
                      placeholder="örn: Etkinlik kampı, lisans yenileme"
              />
            </label>
          ) : null}
          {paymentForm.paymentKind === "private_lesson_package" ? (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[10px] font-black uppercase text-gray-500">Paket seç</span>
              {!paymentForm.profileId ? (
                <>
                  <select disabled className="ui-select min-h-11 w-full cursor-not-allowed opacity-60">
                    <option>Önce sporcu seçin</option>
                  </select>
                  <p className="text-[11px] font-medium text-gray-500">Paket seçmek için önce sporcu seçin.</p>
                </>
              ) : packageOptionsLoading ? (
                <p className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
                  <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  Paketler yükleniyor…
                </p>
              ) : packageOptionsError ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-red-300/90">{packageOptionsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadPackageOptions()}
                    className="text-[11px] font-bold text-emerald-400 underline-offset-2 hover:underline"
                  >
                    Tekrar dene
                  </button>
                </div>
              ) : packageOptions.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                  <p className="text-[11px] font-medium text-gray-400">
                    Bu sporcuya uygun özel ders paketi bulunamadı.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(PATHS.ozelDersPaketleri)}
                    className="mt-2 text-[11px] font-bold text-emerald-400 underline-offset-2 hover:underline"
                  >
                    Özel ders paketlerine git
                  </button>
                </div>
              ) : (
                <>
                  <select
                    className="ui-select min-h-11 w-full appearance-none bg-[#0f1115]"
                    value={paymentForm.packageId}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, packageId: e.target.value }))}
                  >
                    <option value="">Paket seçin</option>
                    {packageOptions.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {formatAccountingPackageOptionLabel(pkg)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] font-medium text-gray-500">
                    Toplam ücret ve kalan tutar seçilen pakete göre gösterilir; fazla tahsilat girilemez.
                  </p>
                </>
              )}
            </div>
          ) : null}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[10px] font-black uppercase text-gray-500">Açıklama</span>
            <textarea
              className="ui-textarea w-full"
              value={paymentForm.description}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
        </div>
        {paymentSubmitError ? (
          <p className="text-[11px] font-medium text-red-300/90" role="alert">
            {paymentSubmitError}
          </p>
        ) : null}
      </fieldset>
      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
        {layout === "modal" && onCancel ? (
          <button
            type="button"
            onClick={() => onCancel()}
            disabled={paymentSubmitting}
            className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            İptal
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handlePaymentSubmit()}
          disabled={paymentSubmitDisabled}
          aria-busy={paymentSubmitting}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-8 text-sm font-black uppercase tracking-wide text-black shadow-lg shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {paymentSubmitting ? "Kaydediliyor..." : "Tahsilatı kaydet"}
        </button>
      </div>
    </div>
  );
}
