import { describe, it, expect } from "vitest";
import { getHandler, listSupportedKinds } from "./registry";
import type { JobKind } from "../jobTypes";

describe("worker handler registry", () => {
  it("exposes the four Faz 12.1 first-target handlers", () => {
    const kinds = listSupportedKinds();
    expect(kinds).toContain("retention.notifications");
    expect(kinds).toContain("retention.auditLogs");
    expect(kinds).toContain("export.audit");
    expect(kinds).toContain("export.payments");
  });

  it("includes the Faz 12.6 retention.jobs handler", () => {
    const kinds = listSupportedKinds();
    expect(kinds).toContain("retention.jobs");
    const h = getHandler("retention.jobs");
    expect(h?.kind).toBe("retention.jobs");
  });

  it("returns handler with matching kind", () => {
    const h = getHandler("retention.notifications");
    expect(h?.kind).toBe("retention.notifications");
  });

  it("returns undefined for unsupported kind", () => {
    const h = getHandler("batch.notifications" as JobKind);
    expect(h).toBeUndefined();
  });

  it("returns undefined for export.performance (Faz 13 target)", () => {
    const h = getHandler("export.performance");
    expect(h).toBeUndefined();
  });
});
