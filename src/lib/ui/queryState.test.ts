import { describe, it, expect } from "vitest";
import {
  clampPagination,
  defaultErrorTitle,
  defaultRetryHint,
  deriveQueryStatus,
  normalizeErrorKind,
  queryErrorCopy,
  toneForErrorKind,
} from "./queryState";

describe("queryState helpers", () => {
  it("toneForErrorKind maps known error kinds", () => {
    expect(toneForErrorKind("permission_denied")).toBe("amber");
    expect(toneForErrorKind("auth_required")).toBe("amber");
    expect(toneForErrorKind("invalid_input")).toBe("amber");
    expect(toneForErrorKind("fetch_error")).toBe("red");
    expect(toneForErrorKind(null)).toBe("red");
  });

  it("deriveQueryStatus prioritizes error over data", () => {
    expect(deriveQueryStatus({ loading: false, hasError: true, hasData: true })).toBe("error");
    expect(deriveQueryStatus({ loading: false, hasError: true, hasData: false })).toBe("error");
  });

  it("deriveQueryStatus distinguishes loading from refreshing", () => {
    expect(deriveQueryStatus({ loading: true, hasError: false, hasData: false })).toBe("loading");
    expect(deriveQueryStatus({ loading: true, hasError: false, hasData: true })).toBe("refreshing");
    expect(deriveQueryStatus({ loading: false, refreshing: true, hasError: false, hasData: true })).toBe(
      "refreshing"
    );
  });

  it("deriveQueryStatus returns empty when data is absent and not loading", () => {
    expect(deriveQueryStatus({ loading: false, hasError: false, hasData: false })).toBe("empty");
  });

  it("defaultErrorTitle and defaultRetryHint match semantics", () => {
    expect(defaultErrorTitle("permission_denied")).toMatch(/yetkiniz/i);
    expect(defaultErrorTitle("fetch_error")).toMatch(/alınamadı/i);
    expect(defaultRetryHint("fetch_error")).toMatch(/tekrar dene/i);
    expect(defaultRetryHint("permission_denied")).toBeNull();
  });

  it("clampPagination floors invalid inputs", () => {
    expect(clampPagination(0, 50)).toEqual({ page: 1, pageSize: 50 });
    expect(clampPagination(-3, 50)).toEqual({ page: 1, pageSize: 50 });
    expect(clampPagination(2, 999)).toEqual({ page: 2, pageSize: 200 });
    expect(clampPagination(2.7, 50)).toEqual({ page: 2, pageSize: 50 });
    expect(clampPagination(2, 0)).toEqual({ page: 2, pageSize: 50 });
  });

  it("normalizeErrorKind falls back to fetch_error for unknown values", () => {
    expect(normalizeErrorKind("permission_denied")).toBe("permission_denied");
    expect(normalizeErrorKind("timeout")).toBe("timeout");
    expect(normalizeErrorKind("nonsense")).toBe("fetch_error");
    expect(normalizeErrorKind(undefined)).toBe("fetch_error");
    expect(normalizeErrorKind(null)).toBe("fetch_error");
  });

  it("queryErrorCopy includes timeout guidance", () => {
    const copy = queryErrorCopy("timeout");
    expect(copy.title).toMatch(/zaman aşımı/i);
    expect(copy.description).toMatch(/daralt/i);
  });
});
