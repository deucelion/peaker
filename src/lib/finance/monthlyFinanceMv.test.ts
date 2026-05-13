import { describe, it, expect, vi } from "vitest";
import {
  lookupMonthlyFinanceMv,
  MONTHLY_FINANCE_MV_STALE_THRESHOLD_MS,
} from "./monthlyFinanceMv";

type MockClient = ReturnType<typeof buildClient>;

function buildClient(behavior: { data?: unknown; error?: { message: string } | null }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: behavior.data ?? null, error: behavior.error ?? null }),
  };
  return {
    from: vi.fn().mockReturnValue(builder),
    __builder: builder,
  };
}

describe("lookupMonthlyFinanceMv", () => {
  it("returns ok when MV row fresh", async () => {
    const client = buildClient({
      data: {
        organization_id: "org-1",
        month_key: "2026-05",
        payment_count: 10,
        collected_amount: 5000,
        pending_amount: 2500,
        overdue_count: 1,
        refreshed_at: new Date(Date.now() - 60_000).toISOString(),
      },
    });
    const result = await lookupMonthlyFinanceMv(client as unknown as MockClient, {
      organizationId: "org-1",
      monthKey: "2026-05",
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.kpi.totalCollected).toBe(5000);
      expect(result.kpi.pendingCollection).toBe(2500);
      expect(result.kpi.source).toBe("mv");
      expect(result.kpi.stale).toBe(false);
    }
  });

  it("returns stale when refreshed_at older than threshold", async () => {
    const oldDate = new Date(Date.now() - MONTHLY_FINANCE_MV_STALE_THRESHOLD_MS - 60_000).toISOString();
    const client = buildClient({
      data: {
        organization_id: "org-1",
        month_key: "2026-05",
        payment_count: 5,
        collected_amount: 100,
        pending_amount: 50,
        overdue_count: 0,
        refreshed_at: oldDate,
      },
    });
    const result = await lookupMonthlyFinanceMv(client as unknown as MockClient, {
      organizationId: "org-1",
      monthKey: "2026-05",
    });
    expect(result.status).toBe("stale");
    if (result.status === "stale") expect(result.refreshedAt).toBe(oldDate);
  });

  it("returns missing when no MV row", async () => {
    const client = buildClient({ data: null });
    const result = await lookupMonthlyFinanceMv(client as unknown as MockClient, {
      organizationId: "org-1",
      monthKey: "2026-05",
    });
    expect(result.status).toBe("missing");
  });

  it("returns error when client errors", async () => {
    const client = buildClient({ error: { message: "permission denied" } });
    const result = await lookupMonthlyFinanceMv(client as unknown as MockClient, {
      organizationId: "org-1",
      monthKey: "2026-05",
    });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toBe("permission denied");
  });
});
