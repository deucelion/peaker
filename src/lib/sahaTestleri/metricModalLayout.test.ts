import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(dirname(fileURLToPath(import.meta.url)), "../../app/(dashboard)/saha-testleri/page.tsx");

describe("saha testleri metric modal layout", () => {
  const source = readFileSync(pagePath, "utf8");
  const modalBlock = source.slice(source.indexOf("showMetricModal &&"));

  it("does not break metric titles with break-all", () => {
    expect(modalBlock).not.toContain("break-all");
  });

  it("uses line-clamp and break-words for long metric names", () => {
    expect(modalBlock).toContain("line-clamp-2");
    expect(modalBlock).toContain("break-words");
  });

  it("uses modal inner scroll and 90dvh cap", () => {
    expect(modalBlock).toContain("max-h-[90dvh]");
    expect(modalBlock).toContain("flex flex-col overflow-hidden");
    expect(modalBlock).toContain("flex-1 min-h-0");
  });

  it("stacks metric controls on narrow viewports", () => {
    expect(modalBlock).toContain("flex flex-col gap-2 min-w-0 w-full");
    expect(modalBlock).toContain("w-full min-w-0 sm:max-w");
  });
});
