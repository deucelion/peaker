import { describe, expect, it } from "vitest";
import { computePaymentStatus, computeRemainingLessons, normalizeMoney } from "@/lib/privateLessons/packageMath";

describe("private lesson package math", () => {
  it("normalizes money to non-negative 2 decimals", () => {
    expect(normalizeMoney("10.235")).toBe(10.24);
    expect(normalizeMoney(-5)).toBe(0);
    expect(normalizeMoney(undefined)).toBe(0);
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
});
