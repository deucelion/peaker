import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPdfDocument,
  isSupportedPdfFontBinary,
  resetPdfFontCacheForTests,
} from "@/lib/pdf/pdfFont";
import { buildFieldTestSingleDatePdf } from "@/lib/pdf/fieldTestPdf";
import { buildFieldTestComparisonPdf } from "@/lib/pdf/fieldTestComparisonPdf";

const realFont = readFileSync(resolve(process.cwd(), "public/fonts/NotoSans-Regular.ttf"));

function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function setFontResponse(body: Uint8Array | null, ok = true) {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => {
    if (!ok || !body) throw new Error("network down");
    return { ok: true, arrayBuffer: async () => toArrayBuffer(body) };
  };
}

const SINGLE_INPUT = {
  orgName: "Kulüp Ağrı",
  athlete: { fullName: "Ali Şıkçı", testDate: "2026-08-11", heightCm: 180, weightKg: 75 },
  numericMetrics: [{ name: "Sprint 10m", category: "Sürat", unit: "sn", value: "1.85" }],
  textMetrics: [{ name: "Postür", category: "Değerlendirme", unit: null, value: "iyi" }],
  generalNote: "Genel değerlendirme notu",
};

beforeAll(() => {
  (globalThis as unknown as { btoa: unknown }).btoa = (s: string) =>
    Buffer.from(s, "binary").toString("base64");
});

beforeEach(() => {
  resetPdfFontCacheForTests();
});

describe("isSupportedPdfFontBinary", () => {
  it("accepts the bundled TrueType font", () => {
    expect(isSupportedPdfFontBinary(new Uint8Array(realFont))).toBe(true);
  });

  it("rejects an HTML body served in place of the font", () => {
    const html = new TextEncoder().encode("<!DOCTYPE html><html><body>Login</body></html>");
    expect(isSupportedPdfFontBinary(html)).toBe(false);
  });

  it("rejects empty and truncated bodies", () => {
    expect(isSupportedPdfFontBinary(new Uint8Array([]))).toBe(false);
    expect(isSupportedPdfFontBinary(new Uint8Array([0x00, 0x01]))).toBe(false);
  });
});

describe("ensurePdfTurkishFont", () => {
  it("enables the turkish font when a real TTF is served", async () => {
    setFontResponse(new Uint8Array(realFont));
    const { turkish } = await createPdfDocument("p");
    expect(turkish).toBe(true);
  });

  it("falls back to helvetica when the font endpoint returns a non-font body", async () => {
    setFontResponse(new TextEncoder().encode("<!DOCTYPE html><html>Login</html>"));
    const { turkish } = await createPdfDocument("p");
    expect(turkish).toBe(false);
  });

  it("falls back to helvetica when the font fetch fails", async () => {
    setFontResponse(null, false);
    const { turkish } = await createPdfDocument("p");
    expect(turkish).toBe(false);
  });
});

/**
 * Regression: müşteri koçlarında PDF üretimi
 * "Cannot read properties of undefined (reading 'widths')" ile çöküyordu.
 * Sebep: font endpoint'i geçerli TTF dışında bir gövde döndürdüğünde bu gövde
 * jsPDF'e font olarak kaydediliyor, ilk metin ölçümünde jsPDF içindeki
 * `font.metadata.Unicode.widths` erişimi patlıyordu.
 */
describe("PDF builders survive a corrupt font response", () => {
  const corruptBodies: Array<[string, Uint8Array]> = [
    ["html login page", new TextEncoder().encode("<!DOCTYPE html><html><body>Login</body></html>")],
    ["proxy error text", new TextEncoder().encode("502 Bad Gateway")],
    ["truncated ttf", new Uint8Array(realFont.subarray(0, 64))],
    ["empty body", new Uint8Array([])],
  ];

  for (const [label, body] of corruptBodies) {
    it(`single-date pdf builds with ${label}`, async () => {
      setFontResponse(body);
      const bytes = await buildFieldTestSingleDatePdf(SINGLE_INPUT);
      expect(bytes.byteLength).toBeGreaterThan(0);
    });

    it(`comparison pdf builds with ${label}`, async () => {
      setFontResponse(body);
      const bytes = await buildFieldTestComparisonPdf({
        orgName: "Kulüp Ağrı",
        athleteName: "Ali Şıkçı",
        dateFrom: "2026-05-01",
        dateTo: "2026-08-11",
        rows: [
          {
            name: "Sprint 10m",
            unit: "sn",
            oldDisplay: "1.95",
            newDisplay: "1.85",
            oldNumeric: 1.95,
            newNumeric: 1.85,
            direction: "lower_better",
          },
          { name: "Postür", unit: null, oldDisplay: "kötü", newDisplay: "iyi", direction: "unknown", isText: true },
        ],
      });
      expect(bytes.byteLength).toBeGreaterThan(0);
    });
  }

  it("builds with a valid font and with an empty dataset", async () => {
    setFontResponse(new Uint8Array(realFont));
    const bytes = await buildFieldTestSingleDatePdf({
      athlete: { fullName: "Ali Şıkçı", testDate: "2026-08-11" },
      numericMetrics: [],
      textMetrics: [],
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
