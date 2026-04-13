import { describe, expect, it } from "vitest";
import { mapMembership } from "./mapMembership";
import { mapOrganization, mapTeamPaymentSummaries } from "./mapOrganization";
import { mapUser } from "./mapUser";
import { hasTimeOverlap } from "./mapLesson";

describe("mappers", () => {
  it("maps membership with safe defaults", () => {
    expect(mapMembership(undefined)).toEqual({
      role: null,
      fullName: "Peaker User",
    });
    expect(mapMembership({ role: "admin", fullName: "Admin User" })).toEqual({
      role: "admin",
      fullName: "Admin User",
    });
  });

  it("maps organization id safely", () => {
    expect(mapOrganization(null)).toEqual({ organizationId: null });
    expect(mapOrganization({ organization_id: "org-1" })).toEqual({ organizationId: "org-1" });
  });

  it("summarizes team payments", () => {
    const summaries = mapTeamPaymentSummaries([
      { team: "A", payments: [{ status: "odendi" }, { status: "bekliyor" }] },
      { team: "A", payments: [{ status: "odendi" }] },
      { team: "B", payments: [{ status: "odendi" }] },
    ]);

    expect(summaries[0]).toEqual({
      teamName: "B",
      completionRate: 100,
      pendingPlayers: 0,
    });
    expect(summaries[1]).toEqual({
      teamName: "A",
      completionRate: 67,
      pendingPlayers: 1,
    });
  });

  it("maps user identity from auth+profile", () => {
    const mapped = mapUser(
      {
        id: "u1",
        email: "u1@mail.com",
        user_metadata: { full_name: "Meta Name" },
      },
      { role: "coach", full_name: "Profile Name" }
    );
    expect(mapped).toEqual({
      id: "u1",
      email: "u1@mail.com",
      role: "coach",
      fullName: "Profile Name",
    });
  });

  it("detects lesson time overlaps", () => {
    expect(
      hasTimeOverlap(
        "2026-04-01T10:00:00.000Z",
        "2026-04-01T11:00:00.000Z",
        "2026-04-01T10:30:00.000Z",
        "2026-04-01T11:30:00.000Z"
      )
    ).toBe(true);

    expect(
      hasTimeOverlap(
        "2026-04-01T10:00:00.000Z",
        "2026-04-01T11:00:00.000Z",
        "2026-04-01T11:00:00.000Z",
        "2026-04-01T12:00:00.000Z"
      )
    ).toBe(false);
  });
});
