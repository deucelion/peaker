import { describe, it, expect } from "vitest";
import {
  buildCsvFromIterable,
  chunkedCsvIterable,
  streamCsvToResponse,
} from "./csvStreamIterable";

describe("buildCsvFromIterable", () => {
  it("collects all rows from async iterable", async () => {
    async function* gen() {
      yield [["a", "1"], ["b", "2"]];
      yield [["c", "3"]];
    }
    const result = await buildCsvFromIterable(["Col1", "Col2"], gen());
    expect(result.rowCount).toBe(3);
    expect(result.csv).toContain("Col1");
    expect(result.csv).toContain("a");
    expect(result.csv).toContain("c");
    expect(result.truncated).toBe(false);
  });

  it("truncates when cap is hit", async () => {
    async function* gen() {
      yield [["a"], ["b"], ["c"], ["d"]];
    }
    const result = await buildCsvFromIterable(["X"], gen(), { maxRows: 2 });
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.cap).toBe(2);
  });

  it("handles empty iterable", async () => {
    async function* gen() {
      // no rows
    }
    const result = await buildCsvFromIterable(["X"], gen());
    expect(result.rowCount).toBe(0);
    expect(result.csv).toContain("X");
  });
});

async function readStreamAsString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  // ignoreBOM:true — aksi halde TextDecoder ilk BOM'u sessizce strip eder ve
  // testlerin BOM doğrulaması yapması imkansızlaşır.
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(merged);
}

describe("streamCsvToResponse", () => {
  it("emits BOM, header, rows with CRLF, no duplicate BOM", async () => {
    async function* gen() {
      yield [["a", "1"], ["b", "2"]];
      yield [["c", "3"]];
    }
    let info: { rowCount: number; truncated: boolean; cap?: number } | null = null;
    const stream = streamCsvToResponse(
      ["Col1", "Col2"],
      gen(),
      undefined,
      { onComplete: (i) => (info = i) }
    );
    const out = await readStreamAsString(stream);
    // BOM yalnızca başta:
    expect(out.indexOf("\uFEFF")).toBe(0);
    expect(out.lastIndexOf("\uFEFF")).toBe(0);
    // Header satırı:
    expect(out).toContain("Col1;Col2");
    // Data satırları CRLF ile:
    expect(out).toContain("a;1\r\n");
    expect(out).toContain("b;2\r\n");
    expect(out).toContain("c;3\r\n");
    expect(info).not.toBeNull();
    expect(info!.rowCount).toBe(3);
    expect(info!.truncated).toBe(false);
  });

  it("truncates and reports via onComplete callback", async () => {
    async function* gen() {
      yield [["a"], ["b"], ["c"], ["d"]];
    }
    let info: { rowCount: number; truncated: boolean; cap?: number } | null = null;
    const stream = streamCsvToResponse(
      ["X"],
      gen(),
      { maxRows: 2 },
      { onComplete: (i) => (info = i) }
    );
    const out = await readStreamAsString(stream);
    expect(out).toContain("a\r\n");
    expect(out).toContain("b\r\n");
    expect(out).not.toContain("c\r\n");
    expect(info!.rowCount).toBe(2);
    expect(info!.truncated).toBe(true);
    expect(info!.cap).toBe(2);
  });

  it("emits header even on empty iterable", async () => {
    async function* gen() {
      // empty
    }
    const stream = streamCsvToResponse(["OnlyHeader"], gen());
    const out = await readStreamAsString(stream);
    expect(out).toContain("\uFEFFOnlyHeader\r\n");
  });

  it("escapes quotes and separators correctly", async () => {
    async function* gen() {
      yield [["plain", `with;sep`, `with "quote"`]];
    }
    const stream = streamCsvToResponse(["A", "B", "C"], gen());
    const out = await readStreamAsString(stream);
    expect(out).toContain(`"with;sep"`);
    expect(out).toContain(`"with ""quote"""`);
  });

  it("invokes onAbort without throwing when signal aborts mid-stream", async () => {
    async function* gen() {
      yield [["a"], ["b"], ["c"]];
    }
    const ac = new AbortController();
    let aborted: { rowCount: number; truncated: boolean; cap?: number } | null = null;
    const stream = streamCsvToResponse(["X"], gen(), undefined, {
      signal: ac.signal,
      onAbort: (i) => {
        aborted = i;
      },
    });
    const reader = stream.getReader();
    await reader.read();
    ac.abort();
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
    expect(aborted).not.toBeNull();
    expect(aborted!.rowCount).toBeGreaterThanOrEqual(0);
    expect(aborted!.truncated).toBe(false);
  });
});

describe("chunkedCsvIterable", () => {
  it("splits source rows into chunks of given size", async () => {
    const source = () => Promise.resolve([1, 2, 3, 4, 5]);
    const iter = chunkedCsvIterable(source, (n) => [String(n)], 2);
    const chunks: number[] = [];
    for await (const chunk of iter) {
      chunks.push(chunk.length);
    }
    expect(chunks).toEqual([2, 2, 1]);
  });

  it("handles empty source", async () => {
    const source = () => Promise.resolve([] as number[]);
    const iter = chunkedCsvIterable(source, (n) => [String(n)], 10);
    const chunks: unknown[] = [];
    for await (const chunk of iter) chunks.push(chunk);
    expect(chunks.length).toBe(0);
  });
});
