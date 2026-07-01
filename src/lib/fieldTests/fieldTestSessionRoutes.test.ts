import { describe, expect, it } from "vitest";
import {
  hrefFieldTestSession,
  isFieldTestSessionDate,
  isFieldTestSessionEntryPath,
} from "./fieldTestSessionRoutes";

describe("fieldTestSessionRoutes", () => {
  it("builds oturum href from ISO date", () => {
    expect(hrefFieldTestSession("2026-06-10")).toBe("/saha-testleri/oturum/2026-06-10");
  });

  it("validates session date format", () => {
    expect(isFieldTestSessionDate("2026-06-10")).toBe(true);
    expect(isFieldTestSessionDate("06-10-2026")).toBe(false);
  });

  it("matches hub and oturum entry paths", () => {
    expect(isFieldTestSessionEntryPath("/saha-testleri")).toBe(true);
    expect(isFieldTestSessionEntryPath("/saha-testleri/oturum/2026-06-10")).toBe(true);
    expect(isFieldTestSessionEntryPath("/saha-testleri/genel-rapor")).toBe(false);
  });
});
