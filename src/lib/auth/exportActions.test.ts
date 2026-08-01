import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

vi.mock("@/lib/rateLimit/exportRateLimit", () => ({
  checkExportRateLimitAsync: vi.fn(),
  formatRateLimitRetryMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/export/csvStreamIterable", () => ({
  streamCsvToResponse: vi.fn(),
  chunkedCsvIterable: vi.fn(),
}));

vi.mock("@/lib/monitoring/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/monitoring/advancedTelemetry", () => ({
  reportExportRun: vi.fn(),
  reportExportStreamTerminal: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  ensureRateLimitSetup: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { checkExportRateLimitAsync } from "@/lib/rateLimit/exportRateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { streamCsvToResponse, chunkedCsvIterable } from "@/lib/export/csvStreamIterable";
import { GET } from "@/app/api/exports/payments/stream/route";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function buildPaymentsStreamRequest() {
  return new Request(
    "http://localhost/api/exports/payments/stream?dateFrom=2026-01-01&dateTo=2026-01-31&paymentStatus=all"
  );
}

function mockAdminSession() {
  vi.mocked(resolveSessionActor).mockResolvedValueOnce({
    actor: {
      id: "user-1",
      role: "admin",
      organizationId: "org-1",
      isActive: true,
    },
  });
}

describe("export actions and stream routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chunkedCsvIterable).mockReturnValue((async function* () {})());
    vi.mocked(streamCsvToResponse).mockReturnValue(new ReadableStream());
  });

  it("does not start denied export or create stream", async () => {
    mockAdminSession();
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const response = await GET(buildPaymentsStreamRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
    expect(checkExportRateLimitAsync).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(streamCsvToResponse).not.toHaveBeenCalled();
  });

  it("runs allowed export and creates stream", async () => {
    mockAdminSession();
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });
    vi.mocked(checkExportRateLimitAsync).mockResolvedValueOnce({
      allowed: true,
      retryAfterMs: 0,
      adapter: "memory",
    });
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    };
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as never);

    const response = await GET(buildPaymentsStreamRequest());

    expect(response.status).toBe(200);
    expect(checkExportRateLimitAsync).toHaveBeenCalled();
    expect(streamCsvToResponse).toHaveBeenCalledTimes(1);
  });

  it("preserves Club Professional parity when kill switch resolves runtime", async () => {
    mockAdminSession();
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "kill_switch",
    });
    vi.mocked(checkExportRateLimitAsync).mockResolvedValueOnce({
      allowed: true,
      retryAfterMs: 0,
      adapter: "memory",
    });
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    };
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as never);

    const response = await GET(buildPaymentsStreamRequest());

    expect(response.status).toBe(200);
    expect(streamCsvToResponse).toHaveBeenCalledTimes(1);
  });
});
