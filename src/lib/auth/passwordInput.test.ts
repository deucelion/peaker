import { describe, expect, it } from "vitest";
import { mapAuthPasswordError, readPasswordInput, validatePasswordMinLength } from "./passwordInput";

describe("passwordInput", () => {
  it("readPasswordInput preserves letters and does not trim", () => {
    expect(readPasswordInput(" abc123 ")).toBe(" abc123 ");
    expect(readPasswordInput("Peaker2026")).toBe("Peaker2026");
  });

  it("validatePasswordMinLength", () => {
    expect(validatePasswordMinLength("12345")).toMatch(/6 karakter/);
    expect(validatePasswordMinLength("abc123")).toBeNull();
  });

  it("mapAuthPasswordError weak password", () => {
    expect(mapAuthPasswordError("Password is known to be weak")).toMatch(/zayıf/);
  });
});
