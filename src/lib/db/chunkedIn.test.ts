import { describe, it, expect, vi } from "vitest";
import { chunkArray, chunkedInQuery } from "./chunkedIn";

describe("chunkedIn — chunkArray", () => {
  it("empty array returns empty", () => {
    expect(chunkArray([], 100)).toEqual([]);
  });

  it("smaller than chunk size returns single chunk", () => {
    expect(chunkArray(["a", "b"], 5)).toEqual([["a", "b"]]);
  });

  it("splits evenly", () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("splits with remainder", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles size <= 0 by clamping to 1", () => {
    expect(chunkArray([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("chunkedIn — chunkedInQuery", () => {
  it("empty ids returns empty data without calling runChunk", async () => {
    const run = vi.fn();
    const res = await chunkedInQuery([], run);
    expect(res).toEqual({ data: [], error: null });
    expect(run).not.toHaveBeenCalled();
  });

  it("single chunk path passes through", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "a" }, { id: "b" }], error: null });
    const res = await chunkedInQuery(["1", "2"], run, { chunkSize: 10 });
    expect(res.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(run).toHaveBeenCalledOnce();
  });

  it("chunks and merges results", async () => {
    const run = vi.fn().mockImplementation(async (chunk: string[]) => ({
      data: chunk.map((c) => ({ id: c })),
      error: null,
    }));
    const ids = ["1", "2", "3", "4", "5"];
    const res = await chunkedInQuery(ids, run, { chunkSize: 2, maxConcurrent: 2 });
    expect(res.error).toBeNull();
    expect(res.data?.map((r) => r.id).sort()).toEqual(["1", "2", "3", "4", "5"]);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("propagates first error with failed chunk index", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "x" }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await chunkedInQuery(["1", "2", "3", "4"], run, {
      chunkSize: 2,
      maxConcurrent: 1,
    });
    expect(res.data).toBeNull();
    expect(res.error?.message).toBe("boom");
    expect(res.error && "failedChunkIndex" in res.error ? res.error.failedChunkIndex : null).toBe(
      1
    );
  });
});
