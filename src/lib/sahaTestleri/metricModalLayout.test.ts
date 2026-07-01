import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const editorPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../app/(dashboard)/saha-testleri/_components/FieldTestMetricsEditor.tsx"
);

describe("saha testleri metric editor layout", () => {
  const source = readFileSync(editorPath, "utf8");
  const listBlock = source.slice(source.indexOf("Tanımlı metrikler"));

  it("does not break metric titles with break-all", () => {
    expect(listBlock).not.toContain("break-all");
  });

  it("uses line-clamp and break-words for long metric names", () => {
    expect(listBlock).toContain("line-clamp-2");
    expect(listBlock).toContain("break-words");
  });

  it("stacks metric controls on narrow viewports", () => {
    expect(listBlock).toContain("flex flex-col gap-2 min-w-0 w-full");
    expect(listBlock).toContain("w-full min-w-0 sm:max-w");
  });

  it("lives on dedicated metrikler page component", () => {
    expect(source).toContain("METRİKLERİ");
    expect(source).toContain("export function FieldTestMetricsEditor");
    expect(source).not.toContain("showMetricModal");
  });
});
