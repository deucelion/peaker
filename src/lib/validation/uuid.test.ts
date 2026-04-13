import { describe, expect, it } from "vitest";
import { isUuid, UUID_V4_REGEX } from "./uuid";

describe("isUuid", () => {
  it("accepts lowercase version-4 UUID", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts uppercase", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects UUID when clock_seq high field variant is not 8/9/a/b", () => {
    expect(isUuid("00000000-0000-4000-0000-000000000000")).toBe(false);
  });

  it("rejects wrong variant position (not 8-b)", () => {
    expect(isUuid("550e8400-e29b-41d4-c716-446655440000")).toBe(false);
  });

  it("rejects empty and non-strings", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });

  it("rejects UUID with extra whitespace", () => {
    expect(isUuid(" 550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });
});

describe("UUID_V4_REGEX", () => {
  it("matches full string only (implicit anchor via usage)", () => {
    expect(UUID_V4_REGEX.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(UUID_V4_REGEX.test("prefix-550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });
});
