import { describe, it, expect } from "vitest";
import { buildCsvFromRows, createInMemoryCsvSink } from "./csvStream";

describe("csvStream", () => {
  it("createInMemoryCsvSink writes rows and finalizes", () => {
    const sink = createInMemoryCsvSink(["A", "B"]);
    expect(sink.write([1, "x"])).toBe(true);
    expect(sink.write([2, "y"])).toBe(true);
    const result = sink.finalize();
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.csv).toContain("A;B");
    expect(result.csv).toContain("1;x");
    expect(result.csv).toContain("2;y");
  });

  it("createInMemoryCsvSink respects maxRows cap", () => {
    const sink = createInMemoryCsvSink(["A"], { maxRows: 2 });
    expect(sink.write([1])).toBe(true);
    expect(sink.write([2])).toBe(true);
    expect(sink.write([3])).toBe(false);
    const result = sink.finalize();
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.cap).toBe(2);
  });

  it("buildCsvFromRows preserves order and respects cap", () => {
    const result = buildCsvFromRows(["X"], [[1], [2], [3]], { maxRows: 2 });
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.csv.split("\r\n").filter(Boolean).length).toBe(3); // header + 2 rows
  });

  it("buildCsvFromRows returns header-only csv when rows are empty", () => {
    const result = buildCsvFromRows(["A", "B"], []);
    expect(result.rowCount).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.csv).toContain("A;B");
  });
});
