import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_PATH = join(process.cwd(), "src/app/(dashboard)/globals.css");

const PHASE_A_BRANDED_CLASSES = [
  "ui-btn-primary",
  "ui-btn-ghost",
  "ui-card",
  "ui-card-chart",
  "ui-toolbar",
  "ui-compact-card",
] as const;

const PHASE_A_SEMANTIC_CLASSES = [
  "ui-btn-danger",
  "ui-badge-success",
  "ui-badge-warning",
  "ui-badge-danger",
] as const;

const BRAND_HEX = /#(?:7c3aed|121215|09090b|6d28d9)\b/i;

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

describe("globals.css Wave 5 primary surfaces", () => {
  const source = readFileSync(GLOBALS_PATH, "utf8");

  it("binds branded ui-* classes to content theme CSS variables", () => {
    for (const className of PHASE_A_BRANDED_CLASSES) {
      const block = extractRuleBlock(source, className);
      expect(block.length, className).toBeGreaterThan(0);
      expect(block, className).toMatch(/var\(--peaker-ui-/);
    }

    expect(extractRuleBlock(source, "ui-btn-primary")).toMatch(/var\(--peaker-ui-PRIMARY/);
    expect(extractRuleBlock(source, "ui-btn-ghost")).toMatch(/var\(--peaker-ui-SURFACE/);
    expect(extractRuleBlock(source, "ui-card")).toMatch(/var\(--peaker-ui-SURFACE/);
  });

  it("does not keep raw brand hex in migrated branded ui-* rules", () => {
    for (const className of PHASE_A_BRANDED_CLASSES) {
      const block = extractRuleBlock(source, className);
      expect(block.replace(/var\(--peaker-ui-[^)]+\)/g, ""), className).not.toMatch(BRAND_HEX);
    }
  });

  it("keeps semantic danger and badge colors frozen", () => {
    expect(extractRuleBlock(source, "ui-btn-danger")).toMatch(/red-500/);
    expect(extractRuleBlock(source, "ui-badge-success")).toMatch(/emerald-500/);
    expect(extractRuleBlock(source, "ui-badge-warning")).toMatch(/amber-500/);
    expect(extractRuleBlock(source, "ui-badge-danger")).toMatch(/red-500/);
  });

  it("does not bind semantic classes to org primary tokens", () => {
    for (const className of PHASE_A_SEMANTIC_CLASSES) {
      const block = extractRuleBlock(source, className);
      expect(block, className).not.toMatch(/var\(--peaker-ui-PRIMARY/);
    }
  });
});
