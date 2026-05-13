import { describe, it, expect } from "vitest";
import { AppError, appErrorFromResult } from "./appError";
import { resolveErrorMeta } from "./errorKinds";

describe("AppError — basic construction", () => {
  it("user() creates user-severity errors", () => {
    const err = AppError.user("permission_denied", "yok");
    expect(err.kind).toBe("permission_denied");
    expect(err.message).toBe("yok");
    expect(err.meta.severity).toBe("user");
    expect(err.meta.retry).toBe("no_retry");
  });

  it("internal() defaults to fetch_error kind", () => {
    const err = AppError.internal("boom");
    expect(err.kind).toBe("fetch_error");
    expect(err.meta.severity).toBe("internal");
    expect(err.meta.retry).toBe("retry_idempotent_only");
  });

  it("transient() yields retry_safe meta", () => {
    const err = AppError.transient("again");
    expect(err.meta.retry).toBe("retry_safe");
    expect(err.meta.severity).toBe("transient");
  });

  it("critical() sets critical severity", () => {
    const err = AppError.critical("schema_drift", "table missing");
    expect(err.meta.severity).toBe("critical");
    expect(err.meta.logLevel).toBe("critical");
  });

  it("fromUnknown() wraps Error", () => {
    const native = new Error("native fail");
    const wrapped = AppError.fromUnknown(native);
    expect(wrapped.message).toBe("native fail");
    expect(wrapped.cause).toBe(native);
  });

  it("fromUnknown() passes through AppError", () => {
    const orig = AppError.user("invalid_input", "x");
    const result = AppError.fromUnknown(orig);
    expect(result).toBe(orig);
  });
});

describe("AppError — serialization", () => {
  it("toServerResult() shape matches existing action contract", () => {
    const err = AppError.user("invalid_input", "geçersiz");
    expect(err.toServerResult()).toEqual({ error: "geçersiz", errorKind: "invalid_input" });
  });

  it("appErrorFromResult() reconstructs AppError", () => {
    const result = { error: "no go", errorKind: "permission_denied" };
    const err = appErrorFromResult(result);
    expect(err.kind).toBe("permission_denied");
    expect(err.message).toBe("no go");
    expect(err.meta.uiKind).toBe("permission_denied");
  });

  it("appErrorFromResult() defaults to fetch_error when kind missing", () => {
    const err = appErrorFromResult({ error: "ouch" });
    expect(err.kind).toBe("fetch_error");
    expect(err.meta.severity).toBe("internal");
  });
});

describe("resolveErrorMeta", () => {
  it("returns default for unknown kind", () => {
    const meta = resolveErrorMeta("totally_made_up");
    expect(meta.severity).toBe("internal");
  });

  it("returns default for null", () => {
    const meta = resolveErrorMeta(null);
    expect(meta.severity).toBe("internal");
  });
});
