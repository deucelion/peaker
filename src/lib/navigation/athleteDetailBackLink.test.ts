import { describe, expect, it } from "vitest";
import {
  hrefAthleteDetail,
  resolveAthleteDetailBackLink,
} from "@/lib/navigation/athleteDetailBackLink";

describe("resolveAthleteDetailBackLink", () => {
  it("returns saha testleri when from=saha-testleri", () => {
    expect(resolveAthleteDetailBackLink("saha-testleri")).toEqual({
      href: "/saha-testleri",
      label: "Saha test oturumuna dön",
    });
  });

  it("defaults to oyuncular for unknown from", () => {
    expect(resolveAthleteDetailBackLink("unknown")).toEqual({
      href: "/oyuncular",
      label: "Kadro listesine dön",
    });
  });
});

describe("hrefAthleteDetail", () => {
  it("builds link with from and hash for saha testleri", () => {
    expect(hrefAthleteDetail("abc", "saha-testleri", "alan-testleri")).toBe(
      "/sporcu/abc?from=saha-testleri#alan-testleri"
    );
  });

  it("omits query when from is oyuncular", () => {
    expect(hrefAthleteDetail("abc", "oyuncular")).toBe("/sporcu/abc");
  });
});
