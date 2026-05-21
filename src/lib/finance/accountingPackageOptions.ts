import type { AccountingFinancePackageOption } from "@/lib/actions/accountingFinanceActions";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";
import {
  packageAllowsPayment,
  PACKAGE_LIFECYCLE_LABEL,
  resolvePackageLifecycleStatus,
  type PackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";

export const PACKAGE_FETCH_TIMEOUT_MS = 10_000;
export const PAYMENT_SUBMIT_TIMEOUT_MS = 25_000;

export function withAsyncTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export type AccountingPackageRowInput = {
  id: string;
  package_name?: string | null;
  remaining_lessons?: number | null;
  total_price?: number | string | null;
  amount_paid?: number | string | null;
  payment_status?: string | null;
  is_active?: boolean | null;
  lifecycle_status?: string | null;
  next_payment_due_at?: string | null;
  total_lessons?: number | null;
  used_lessons?: number | null;
};

export function mapAccountingPackageOption(row: AccountingPackageRowInput): AccountingFinancePackageOption & {
  lifecycleStatus: PackageLifecycleStatus;
  remainingBalance: number;
} {
  const totalPrice = normalizeMoney(row.total_price);
  const amountPaid = normalizeMoney(row.amount_paid);
  const remainingLessons = Math.max(0, Math.floor(Number(row.remaining_lessons) || 0));
  const lifecycleStatus = resolvePackageLifecycleStatus({
    lifecycleStatus: row.lifecycle_status,
    isActive: row.is_active !== false,
    remainingLessons,
    totalLessons: Math.max(0, Math.floor(Number(row.total_lessons) || 0)),
    usedLessons: Math.max(0, Math.floor(Number(row.used_lessons) || 0)),
  });
  return {
    id: String(row.id),
    packageName: String(row.package_name || "Paket"),
    remainingLessons,
    totalPrice,
    amountPaid,
    paymentStatus: (row.payment_status as AccountingFinancePackageOption["paymentStatus"]) || "unpaid",
    isActive: row.is_active !== false,
    lifecycleStatus,
    remainingBalance: Math.max(0, normalizeMoney(totalPrice - amountPaid)),
    nextPaymentDueAt: row.next_payment_due_at?.trim() || null,
  };
}

export function filterPackagesEligibleForCollection(
  rows: AccountingPackageRowInput[]
): (AccountingFinancePackageOption & { lifecycleStatus: PackageLifecycleStatus; remainingBalance: number })[] {
  return rows
    .map(mapAccountingPackageOption)
    .filter((p) => {
      if (!packageAllowsPayment(p.lifecycleStatus)) return false;
      if (p.totalPrice <= 0) return true;
      return p.remainingBalance > 0.001;
    });
}

export function formatAccountingPackageOptionLabel(
  pkg: AccountingFinancePackageOption & {
    lifecycleStatus?: PackageLifecycleStatus;
    remainingBalance?: number;
    nextPaymentDueAt?: string | null;
  }
): string {
  const remainingPay = pkg.remainingBalance ?? normalizeMoney(pkg.totalPrice - pkg.amountPaid);
  const lifecycle =
    pkg.lifecycleStatus != null ? PACKAGE_LIFECYCLE_LABEL[pkg.lifecycleStatus] : null;
  const due =
    pkg.nextPaymentDueAt && Number.isFinite(Date.parse(pkg.nextPaymentDueAt))
      ? ` · Vade ${new Date(`${pkg.nextPaymentDueAt.slice(0, 10)}T12:00:00`).toLocaleDateString("tr-TR")}`
      : "";
  const statusBit = lifecycle ? ` · ${lifecycle}` : "";
  return `${pkg.packageName} · Kalan ${pkg.remainingLessons} ders · Açık bakiye ₺${remainingPay.toLocaleString("tr-TR")}${statusBit}${due}`;
}
