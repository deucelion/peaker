import { describe, expect, it } from "vitest";
import {
  computeIncrementalAmountPaid,
  computePaymentStatus,
  computeRemainingLessons,
  normalizeMoney,
  parseMoneyInput,
} from "@/lib/privateLessons/packageMath";

describe("private lesson package math", () => {
  it("normalizes money to non-negative 2 decimals", () => {
    expect(normalizeMoney("10.24")).toBe(10.24);
    expect(normalizeMoney("10.000")).toBe(10000);
    expect(normalizeMoney(-5)).toBe(0);
    expect(normalizeMoney(undefined)).toBe(0);
  });

  it("parses money inputs in locale-safe way", () => {
    expect(parseMoneyInput("18.000")).toBe(18000);
    expect(parseMoneyInput("18,000.50")).toBe(18000.5);
    expect(parseMoneyInput("18.000,50")).toBe(18000.5);
    expect(parseMoneyInput("1250,75")).toBe(1250.75);
    expect(parseMoneyInput("abc")).toBeNull();
  });

  it("computes payment status correctly", () => {
    expect(computePaymentStatus(1000, 0)).toBe("unpaid");
    expect(computePaymentStatus(1000, 250)).toBe("partial");
    expect(computePaymentStatus(1000, 1000)).toBe("paid");
    expect(computePaymentStatus(0, 0)).toBe("paid");
  });

  it("computes remaining lessons safely", () => {
    expect(computeRemainingLessons(10, 3)).toBe(7);
    expect(computeRemainingLessons(10, 12)).toBe(0);
    expect(computeRemainingLessons(-1, 0)).toBe(0);
  });

  it("adds incremental payment on top of current paid amount", () => {
    expect(computeIncrementalAmountPaid(100, 25)).toBe(125);
    expect(computeIncrementalAmountPaid(100.1, 0.2)).toBe(100.3);
    expect(computeIncrementalAmountPaid(0, -10)).toBe(0);
  });

  it("keeps payment status consistent after incremental updates", () => {
    const totalPrice = 800;
    const afterFirst = computeIncrementalAmountPaid(0, 200);
    const afterSecond = computeIncrementalAmountPaid(afterFirst, 500);
    const afterThird = computeIncrementalAmountPaid(afterSecond, 100);

    expect(computePaymentStatus(totalPrice, afterFirst)).toBe("partial");
    expect(computePaymentStatus(totalPrice, afterSecond)).toBe("partial");
    expect(computePaymentStatus(totalPrice, afterThird)).toBe("paid");
  });
});
