import type { PrivateLessonPaymentStatus } from "@/lib/types";

export function normalizeMoney(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function computePaymentStatus(totalPriceInput: number, amountPaidInput: number): PrivateLessonPaymentStatus {
  const totalPrice = normalizeMoney(totalPriceInput);
  const amountPaid = normalizeMoney(amountPaidInput);
  if (totalPrice <= 0) return "paid";
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= totalPrice) return "paid";
  return "partial";
}

export function computeRemainingLessons(totalLessonsInput: number, usedLessonsInput: number): number {
  const totalLessons = Math.max(0, Math.floor(totalLessonsInput));
  const usedLessons = Math.max(0, Math.floor(usedLessonsInput));
  return Math.max(totalLessons - usedLessons, 0);
}

export function computeIncrementalAmountPaid(currentAmountPaidInput: number, paymentAmountInput: number): number {
  const currentAmountPaid = normalizeMoney(currentAmountPaidInput);
  const paymentAmount = normalizeMoney(paymentAmountInput);
  return normalizeMoney(currentAmountPaid + paymentAmount);
}
