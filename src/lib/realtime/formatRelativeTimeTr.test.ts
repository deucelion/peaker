import { describe, expect, it } from "vitest";
import { formatRelativeTimeTr } from "./formatRelativeTimeTr";

describe("formatRelativeTimeTr", () => {
  it("returns az önce for recent timestamps", () => {
    const now = Date.UTC(2026, 4, 20, 12, 0, 0);
    const iso = new Date(now - 20_000).toISOString();
    expect(formatRelativeTimeTr(iso, now)).toBe("az önce");
  });

  it("returns minutes for medium offsets", () => {
    const now = Date.UTC(2026, 4, 20, 12, 0, 0);
    const iso = new Date(now - 5 * 60_000).toISOString();
    expect(formatRelativeTimeTr(iso, now)).toBe("5 dk önce");
  });
});
