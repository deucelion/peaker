import { describe, expect, it } from "vitest";
import { paginatePostgrestSelect } from "./paginatePostgrestRange";

describe("paginatePostgrestSelect", () => {
  it("fetches all pages beyond the 1000-row cap", async () => {
    const pageSize = 1000;
    let calls = 0;

    const result = await paginatePostgrestSelect(async (from, to) => {
      calls += 1;
      if (from === 0) {
        return {
          data: Array.from({ length: pageSize }, (_, index) => ({ id: `row-${index}` })),
          error: null,
        };
      }
      if (from === pageSize) {
        return {
          data: Array.from({ length: 250 }, (_, index) => ({ id: `row-${pageSize + index}` })),
          error: null,
        };
      }
      return { data: [], error: null };
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1250);
    expect(calls).toBe(2);
  });

  it("stops at the safety ceiling instead of paging forever", async () => {
    const pageSize = 1000;
    let calls = 0;

    const result = await paginatePostgrestSelect(
      async () => {
        calls += 1;
        return {
          data: Array.from({ length: pageSize }, (_, index) => ({ id: `row-${index}` })),
          error: null,
        };
      },
      pageSize,
      2500
    );

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(3000);
    expect(calls).toBe(3);
  });

  it("returns first page error without merging partial rows", async () => {
    const result = await paginatePostgrestSelect(async () => ({
      data: null,
      error: { message: "boom" },
    }));

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("boom");
  });
});
