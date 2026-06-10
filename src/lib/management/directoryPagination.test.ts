import { describe, expect, it } from "vitest";
import {
  normalizeDirectoryPagination,
  totalDirectoryPages,
  DIRECTORY_DEFAULT_PAGE_SIZE,
} from "./directoryPagination";

describe("normalizeDirectoryPagination", () => {
  it("defaults to page 1 and standard page size", () => {
    const p = normalizeDirectoryPagination();
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(DIRECTORY_DEFAULT_PAGE_SIZE);
    expect(p.from).toBe(0);
    expect(p.to).toBe(DIRECTORY_DEFAULT_PAGE_SIZE - 1);
  });

  it("clamps page size to max", () => {
    const p = normalizeDirectoryPagination(2, 500, 100);
    expect(p.page).toBe(2);
    expect(p.pageSize).toBe(100);
    expect(p.from).toBe(100);
    expect(p.to).toBe(199);
  });
});

describe("totalDirectoryPages", () => {
  it("computes pages from total and size", () => {
    expect(totalDirectoryPages(0, 30)).toBe(1);
    expect(totalDirectoryPages(31, 30)).toBe(2);
    expect(totalDirectoryPages(60, 30)).toBe(2);
  });
});
