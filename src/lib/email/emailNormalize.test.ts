import { describe, expect, it } from "vitest";
import { normalizeEmailInput, SIMPLE_EMAIL_RE } from "./emailNormalize";

describe("normalizeEmailInput", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmailInput("  Test@MAIL.COM  ")).toBe("test@mail.com");
  });

  it("maps turkish characters in local part to ascii", () => {
    expect(normalizeEmailInput("testğ@mail.com")).toBe("testg@mail.com");
  });

  it("handles nullish", () => {
    expect(normalizeEmailInput(null)).toBe("");
    expect(normalizeEmailInput(undefined)).toBe("");
  });
});

describe("SIMPLE_EMAIL_RE", () => {
  it("accepts basic emails", () => {
    expect(SIMPLE_EMAIL_RE.test("a@b.co")).toBe(true);
    expect(SIMPLE_EMAIL_RE.test("coach+1@club.com")).toBe(true);
  });

  it("rejects invalid", () => {
    expect(SIMPLE_EMAIL_RE.test("not-an-email")).toBe(false);
    expect(SIMPLE_EMAIL_RE.test("@nodomain.com")).toBe(false);
  });
});
