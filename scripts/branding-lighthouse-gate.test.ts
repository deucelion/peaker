import { describe, expect, it } from "vitest";
import { runLighthouseGate } from "./branding-lighthouse-gate";

describe("branding-lighthouse-gate", () => {
  it("skips when LIGHTHOUSE_URL is unset (local/PR default)", () => {
    const previous = process.env.LIGHTHOUSE_URL;
    delete process.env.LIGHTHOUSE_URL;
    const result = runLighthouseGate();
    expect(result.ok).toBe(true);
    if (previous === undefined) {
      delete process.env.LIGHTHOUSE_URL;
    } else {
      process.env.LIGHTHOUSE_URL = previous;
    }
  });
});
