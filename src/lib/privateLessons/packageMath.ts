import type { PrivateLessonPaymentStatus } from "@/lib/types";

export function normalizeMoney(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

// Parses human-entered money safely for both tr-TR and en-US styles.
export function parseMoneyInput(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return normalizeMoney(value);
  }
  const raw = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[₺$€£]/g, "");
  if (!raw) return null;

  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let normalized = raw;

  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf(".");
    const lastComma = raw.lastIndexOf(",");
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = raw.split(",");
    const maybeDecimal = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2;
    normalized = maybeDecimal ? raw.replace(",", ".") : raw.replace(/,/g, "");
  } else if (hasDot) {
    const parts = raw.split(".");
    const maybeDecimal = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2;
    normalized = maybeDecimal ? raw : raw.replace(/\./g, "");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return normalizeMoney(n);
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
