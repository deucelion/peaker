import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("exposes standalone display and theme", () => {
    expect(manifest().display).toBe("standalone");
    expect(manifest().theme_color).toBe("#09090b");
    expect(manifest().icons?.length).toBeGreaterThan(0);
  });
});
