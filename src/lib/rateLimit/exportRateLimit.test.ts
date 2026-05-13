import { describe, it, expect } from "vitest";
import { formatRateLimitRetryMessage } from "./exportRateLimit";

describe("formatRateLimitRetryMessage", () => {
  it("returns empty string when allowed", () => {
    const msg = formatRateLimitRetryMessage({ allowed: true, remaining: 5 }, "audit");
    expect(msg).toBe("");
  });

  it("formats audit denial message", () => {
    const msg = formatRateLimitRetryMessage(
      { allowed: false, retryAfterMs: 3200, remaining: 0 },
      "audit"
    );
    expect(msg).toMatch(/Audit dışa aktarımı/);
    expect(msg).toMatch(/4 saniye/);
  });

  it("formats accounting denial message", () => {
    const msg = formatRateLimitRetryMessage(
      { allowed: false, retryAfterMs: 1000, remaining: 0 },
      "accounting"
    );
    expect(msg).toMatch(/Tahsilat dışa aktarımı/);
    expect(msg).toMatch(/1 saniye/);
  });

  it("rounds up sub-second to 1", () => {
    const msg = formatRateLimitRetryMessage(
      { allowed: false, retryAfterMs: 100, remaining: 0 },
      "performance"
    );
    expect(msg).toMatch(/1 saniye/);
  });

  it("falls back to generic label for unknown scope", () => {
    const msg = formatRateLimitRetryMessage(
      { allowed: false, retryAfterMs: 2000, remaining: 0 },
      "unknown" as never
    );
    expect(msg).toMatch(/Bu işlem/);
  });
});
