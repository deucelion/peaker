import { describe, expect, it } from "vitest";
import { withAsyncTimeout } from "@/lib/finance/accountingPackageOptions";

describe("withAsyncTimeout", () => {
  it("resolves when promise finishes in time", async () => {
    const v = await withAsyncTimeout(Promise.resolve(42), 500, "timeout");
    expect(v).toBe(42);
  });

  it("rejects on timeout", async () => {
    await expect(
      withAsyncTimeout(
        new Promise<number>((resolve) => setTimeout(() => resolve(1), 200)),
        50,
        "İşlem zaman aşımına uğradı."
      )
    ).rejects.toThrow("zaman aşımı");
  });
});
