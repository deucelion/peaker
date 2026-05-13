import { describe, it, expect } from "vitest";
import { buildCsv, csvCell, csvFilename } from "./csv";

describe("csvCell", () => {
  it("encodes null/undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("preserves plain numbers", () => {
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("escapes ; and quotes", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('"')).toBe('""""');
    expect(csvCell("multi\nline")).toBe('"multi\nline"');
  });

  it("blocks formula injection via leading =/+/-/@", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    // sade negatif sayı string'i da prefix alır (string olduğu için): kabul edilebilir tradeoff.
    expect(csvCell("-1")).toBe("'-1");
  });
});

describe("buildCsv", () => {
  it("prepends UTF-8 BOM and uses ; separator + CRLF", () => {
    const csv = buildCsv(["a", "b"], [
      ["1", "x"],
      ["2", "y;z"],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const body = csv.slice(1);
    const lines = body.split("\r\n");
    expect(lines[0]).toBe("a;b");
    expect(lines[1]).toBe("1;x");
    expect(lines[2]).toBe('2;"y;z"');
    expect(body.endsWith("\r\n")).toBe(true);
  });
});

describe("csvFilename", () => {
  it("produces ASCII-safe filename with date stamp", () => {
    const name = csvFilename("Muhasebe", "Tahsilat Listesi", { month: "2026-05" });
    expect(name).toMatch(/^muhasebe_tahsilat-listesi_month-2026-05_\d{8}\.csv$/);
  });

  it("normalizes Turkish characters", () => {
    const name = csvFilename("Müşteri", "Özel");
    expect(name).toMatch(/^musteri_ozel_\d{8}\.csv$/);
  });
});
