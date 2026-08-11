import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_PATH = join(process.cwd(), "src/app/(dashboard)/globals.css");

const OVERLAY_CLASSES = [
  "ui-overlay-backdrop",
  "ui-overlay-container",
  "ui-overlay-shell",
  "ui-dialog",
  "ui-drawer",
  "ui-overlay-sheet",
  "ui-overlay-menu",
  "ui-overlay-footer",
] as const;

function extractRuleBlock(source: string, className: string): string {
  const marker = `.${className}`;
  const start = source.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    return "";
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return "";
}

describe("globals.css Wave 7 overlay primitives", () => {
  const source = readFileSync(GLOBALS_PATH, "utf8");

  it("declares shared overlay CSS classes", () => {
    for (const className of OVERLAY_CLASSES) {
      expect(extractRuleBlock(source, className).length, className).toBeGreaterThan(0);
    }
  });

  it("binds overlay shell and footer to content theme tokens", () => {
    expect(extractRuleBlock(source, "ui-overlay-shell")).toMatch(/var\(--peaker-ui-SURFACE/);
    expect(extractRuleBlock(source, "ui-overlay-footer")).toMatch(/var\(--peaker-ui-SURFACE/);
  });
});
