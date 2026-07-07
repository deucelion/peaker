import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  loadAthletePermissionsForProxy,
  resetProxyAdminClientCacheForTests,
} from "@/lib/auth/proxyPermissionReads";
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";

describe("loadAthletePermissionsForProxy", () => {
  beforeEach(() => {
    resetProxyAdminClientCacheForTests();
    vi.unstubAllEnvs();
  });

  it("returns defaults when org id is missing", async () => {
    await expect(loadAthletePermissionsForProxy("user-1", null)).resolves.toEqual(
      DEFAULT_ATHLETE_PERMISSIONS
    );
  });

  it("fail-closed when service role key is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const perms = await loadAthletePermissionsForProxy("user-1", "org-1");
    expect(perms.can_view_calendar).toBe(false);
    expect(perms.can_view_development_profile).toBe(false);
  });
});
