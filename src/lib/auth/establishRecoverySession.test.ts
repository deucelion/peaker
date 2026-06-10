import { describe, expect, it } from "vitest";
import { parseAuthHashParams } from "./parseAuthHashParams";

describe("parseAuthHashParams", () => {
  it("parses hash fragment params", () => {
    const params = parseAuthHashParams("#access_token=abc&refresh_token=def&type=recovery");
    expect(params?.get("access_token")).toBe("abc");
    expect(params?.get("refresh_token")).toBe("def");
    expect(params?.get("type")).toBe("recovery");
  });

  it("returns null for empty hash", () => {
    expect(parseAuthHashParams("")).toBeNull();
    expect(parseAuthHashParams("#")).toBeNull();
  });
});
