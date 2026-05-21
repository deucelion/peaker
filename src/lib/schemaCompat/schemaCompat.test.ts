import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEMA_CAPABILITIES, buildDriftWarnings } from "@/lib/schemaCompat/capabilities";
import {
  buildPrivateLessonPackageSelect,
  buildPrivateLessonPackageSelectLegacy,
  buildReceivablePackageSelect,
} from "@/lib/schemaCompat/packageSelect";
import { isMissingColumnError, isSchemaCompatibilityError } from "@/lib/schemaCompat/errors";
import { applyPrivateLessonPaymentActiveFilter } from "@/lib/schemaCompat/paymentSelect";
import { mapPackageRowCompat } from "@/lib/schemaCompat/packageSelect";
import { auditListUserMessage, userFacingDataError } from "@/lib/schemaCompat/userMessages";

describe("schemaCompat errors", () => {
  it("detects missing column messages", () => {
    expect(isMissingColumnError('column "voided_at" does not exist', "voided_at")).toBe(true);
    expect(isMissingColumnError("permission denied")).toBe(false);
  });

  it("flags schema compatibility errors for user messages", () => {
    expect(isSchemaCompatibilityError('column private_lesson_packages.lifecycle_status does not exist')).toBe(
      true
    );
  });
});

describe("package select builders", () => {
  it("includes lifecycle when capability on", () => {
    const caps = {
      ...DEFAULT_SCHEMA_CAPABILITIES,
      packages: { lifecycleStatus: true, installmentFields: true, packageEventsTable: true },
      payments: DEFAULT_SCHEMA_CAPABILITIES.payments,
      driftWarnings: [],
    };
    expect(buildPrivateLessonPackageSelect(caps)).toContain("lifecycle_status");
    expect(buildReceivablePackageSelect(caps)).toContain("next_payment_due_at");
  });

  it("legacy select omits lifecycle", () => {
    expect(buildPrivateLessonPackageSelectLegacy()).not.toContain("lifecycle_status");
  });
});

describe("mapPackageRowCompat", () => {
  it("derives active from is_active when lifecycle column absent", () => {
    const pkg = mapPackageRowCompat({
      id: "1",
      organization_id: "o",
      athlete_id: "a",
      coach_id: null,
      package_type: "standard",
      package_name: "P",
      total_lessons: 10,
      used_lessons: 2,
      remaining_lessons: 8,
      total_price: 1000,
      amount_paid: 500,
      payment_status: "partial",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(pkg.lifecycleStatus).toBe("active");
  });
});

describe("payment active filter", () => {
  it("skips voided_at filter when column missing", () => {
    const caps = {
      ...DEFAULT_SCHEMA_CAPABILITIES,
      payments: { privateLessonVoidedAt: false, privateLessonVoidRpc: false },
    };
    const calls: string[] = [];
    const q = {
      is: (col: string) => {
        calls.push(col);
        return q;
      },
    };
    applyPrivateLessonPaymentActiveFilter(q as never, caps);
    expect(calls).not.toContain("voided_at");
  });
});

describe("user messages", () => {
  it("sanitizes schema errors", () => {
    const msg = userFacingDataError("Paketler alınamadı", "column lifecycle_status does not exist");
    expect(msg).toContain("şema uyumluluk");
    expect(msg).not.toContain("lifecycle_status");
  });

  it("audit list returns diagnostics code", () => {
    const copy = auditListUserMessage("fetch_error");
    expect(copy.diagnosticsCode).toBe("AUD-FETCH_ERROR");
    expect(copy.title).toContain("alınamıyor");
  });
});

describe("drift warnings", () => {
  it("lists missing capabilities", () => {
    const w = buildDriftWarnings(DEFAULT_SCHEMA_CAPABILITIES);
    expect(w.length).toBeGreaterThan(0);
  });
});
