import { describe, expect, it } from "vitest";
import {
  formatCurrencyTRY,
  normalizeMoney,
  parseTRYMoneyInput,
  requireTRYMoneyInput,
} from "@/lib/privateLessons/packageMath";

describe("parseTRYMoneyInput", () => {
  it("parses plain integers without thousand separators", () => {
    expect(parseTRYMoneyInput("10000")).toBe(10000);
    expect(parseTRYMoneyInput(10000)).toBe(10000);
  });

  it("parses Turkish thousand and decimal separators", () => {
    expect(parseTRYMoneyInput("10.000")).toBe(10000);
    expect(parseTRYMoneyInput("10.000,50")).toBe(10000.5);
    expect(parseTRYMoneyInput("18.000")).toBe(18000);
    expect(parseTRYMoneyInput("1250,75")).toBe(1250.75);
  });

  it("parses US-style separators", () => {
    expect(parseTRYMoneyInput("18,000.50")).toBe(18000.5);
    expect(parseTRYMoneyInput("10000.50")).toBe(10000.5);
  });

  it("rejects invalid input", () => {
    expect(parseTRYMoneyInput("")).toBeNull();
    expect(parseTRYMoneyInput("abc")).toBeNull();
    expect(parseTRYMoneyInput("-5")).toBeNull();
  });

  it("normalizeMoney does not truncate 10.000 to 10", () => {
    expect(normalizeMoney("10.000")).toBe(10000);
    expect(normalizeMoney("10000")).toBe(10000);
  });

  it("requireTRYMoneyInput validates positive amounts", () => {
    expect(requireTRYMoneyInput("10000").ok).toBe(true);
    expect(requireTRYMoneyInput("0").ok).toBe(false);
    expect(requireTRYMoneyInput("").ok).toBe(false);
  });

  it("formatCurrencyTRY displays tr-TR", () => {
    const formatted = formatCurrencyTRY(10000);
    expect(formatted.startsWith("₺")).toBe(true);
    expect(formatted.replace(/\D/g, "")).toContain("10000");
  });
});
