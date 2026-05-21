import { describe, expect, it } from "vitest";
import { validateProductionEnv } from "@/lib/ops/envValidation";

describe("validateProductionEnv", () => {
  it("returns structured env report", () => {
    const report = validateProductionEnv();
    expect(report.checks.some((c) => c.key === "NEXT_PUBLIC_SUPABASE_URL")).toBe(true);
    expect(report.checks.some((c) => c.key === "SUPABASE_SERVICE_ROLE_KEY")).toBe(true);
  });
});
