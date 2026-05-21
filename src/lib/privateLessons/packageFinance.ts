import { normalizeMoney } from "@/lib/privateLessons/packageMath";
import type { PackageFinanceSummary, PrivateLessonPackage, PrivateLessonPayment } from "@/lib/types";

export type { PackageFinanceSummary };

const MAX_TRY_AMOUNT = 50_000_000;

export function assertValidTRYMoneyAmount(
  value: number,
  fieldLabel = "Tutar"
): { ok: true; amount: number } | { ok: false; error: string } {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return { ok: false, error: `${fieldLabel} geçerli bir sayı olmalıdır.` };
  }
  if (value === Infinity || value === -Infinity) {
    return { ok: false, error: `${fieldLabel} sınır dışı.` };
  }
  if (value <= 0) {
    return { ok: false, error: `${fieldLabel} sıfırdan büyük olmalıdır.` };
  }
  if (value > MAX_TRY_AMOUNT) {
    return { ok: false, error: `${fieldLabel} çok yüksek.` };
  }
  return { ok: true, amount: normalizeMoney(value) };
}

export function calculatePackageFinanceSummary(input: {
  pkg: Pick<
    PrivateLessonPackage,
    | "totalPrice"
    | "amountPaid"
    | "paymentStatus"
    | "installmentCount"
    | "installmentIntervalDays"
    | "nextPaymentDueAt"
  >;
  payments: PrivateLessonPayment[];
  now?: Date;
}): PackageFinanceSummary {
  const totalPrice = normalizeMoney(input.pkg.totalPrice);
  const amountPaid = normalizeMoney(input.pkg.amountPaid);
  const remainingBalance = Math.max(0, normalizeMoney(totalPrice - amountPaid));
  const paymentCount = input.payments.length;
  const lastPaymentAt =
    paymentCount > 0
      ? input.payments.reduce((latest, p) => {
          const t = Date.parse(p.paidAt);
          if (!Number.isFinite(t)) return latest;
          if (!latest) return p.paidAt;
          return t > Date.parse(latest) ? p.paidAt : latest;
        }, null as string | null)
      : null;

  const now = input.now ?? new Date();
  const nextDue = input.pkg.nextPaymentDueAt;
  const installmentOverdue =
    remainingBalance > 0.001 &&
    Boolean(nextDue) &&
    Number.isFinite(Date.parse(nextDue!)) &&
    Date.parse(nextDue!) < now.getTime();

  return {
    totalPrice,
    amountPaid,
    remainingBalance,
    paymentCount,
    lastPaymentAt,
    paymentComplete: input.pkg.paymentStatus === "paid" || remainingBalance <= 0.001,
    installmentOverdue,
    installmentCount: input.pkg.installmentCount ?? null,
    installmentIntervalDays: input.pkg.installmentIntervalDays ?? null,
    nextPaymentDueAt: input.pkg.nextPaymentDueAt ?? null,
  };
}
