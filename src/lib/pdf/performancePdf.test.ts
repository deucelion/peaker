import { describe, expect, it } from "vitest";
import { buildPerformanceAnalysisPdf, PerformancePdfNoDataError } from "./performancePdf";

describe("performancePdf", () => {
  it("veri yokken PDF uretmez", async () => {
    await expect(
      buildPerformanceAnalysisPdf({
        athleteName: "Eyüp Akhan",
        periodLabel: "1 May 2026 – 3 Haz 2026",
        acwrSeries: [],
        ewmaSeries: [],
        loads30: [],
        acwr30: [],
      })
    ).rejects.toBeInstanceOf(PerformancePdfNoDataError);
  });
});
