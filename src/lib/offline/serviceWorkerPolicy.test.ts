import { describe, expect, it } from "vitest";
import {
  isStaticAssetCacheable,
  shouldNeverCacheRequest,
  PRECACHE_URLS,
} from "@/lib/offline/serviceWorkerPolicy";

describe("serviceWorkerPolicy", () => {
  const origin = "https://app.peaker.test";

  it("never caches api and exports", () => {
    expect(
      shouldNeverCacheRequest({
        pathname: "/api/me-role",
        method: "GET",
        hostname: "app.peaker.test",
        origin,
        appOrigin: origin,
      })
    ).toBe(true);
    expect(
      shouldNeverCacheRequest({
        pathname: "/api/exports/payments/stream",
        method: "GET",
        hostname: "app.peaker.test",
        origin,
        appOrigin: origin,
      })
    ).toBe(true);
  });

  it("allows static asset paths", () => {
    expect(isStaticAssetCacheable("/_next/static/chunks/foo.js")).toBe(true);
    expect(isStaticAssetCacheable("/icons/icon.svg")).toBe(true);
    expect(isStaticAssetCacheable("/sporcu")).toBe(false);
  });

  it("precache list includes offline shell", () => {
    expect(PRECACHE_URLS).toContain("/offline");
  });
});
