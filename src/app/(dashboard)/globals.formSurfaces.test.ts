import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUERY_TONE_CLASS } from "@/lib/ui/queryState";

const GLOBALS_PATH = join(process.cwd(), "src/app/(dashboard)/globals.css");

const WAVE_6_FORM_CLASSES = ["ui-input", "ui-select", "ui-textarea"] as const;

const BRAND_HEX = /#(?:7c3aed|121215|09090b|6d28d9|1c1c21)\b/i;

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

function extractFocusRuleBlock(source: string, className: string): string {
  const marker = `.${className}:focus`;
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

describe("globals.css Wave 6 form surfaces", () => {
  const source = readFileSync(GLOBALS_PATH, "utf8");

  it("binds ui-input, ui-select and ui-textarea to content theme tokens", () => {
    for (const className of WAVE_6_FORM_CLASSES) {
      const block = extractRuleBlock(source, className);
      expect(block.length, className).toBeGreaterThan(0);
      expect(block, className).toMatch(/var\(--peaker-ui-SURFACE/);
      expect(block, className).toMatch(/var\(--peaker-ui-TEXT_PRIMARY/);
    }
  });

  it("uses primary token for form focus borders", () => {
    for (const className of WAVE_6_FORM_CLASSES) {
      const focusBlock = extractFocusRuleBlock(source, className);
      expect(focusBlock, className).toMatch(/var\(--peaker-ui-PRIMARY/);
    }
  });

  it("does not keep raw brand hex in migrated form rules", () => {
    for (const className of WAVE_6_FORM_CLASSES) {
      const block = `${extractRuleBlock(source, className)}${extractFocusRuleBlock(source, className)}`;
      expect(block.replace(/var\(--peaker-ui-[^)]+\)/g, ""), className).not.toMatch(BRAND_HEX);
    }
  });
});

describe("QUERY_TONE_CLASS Wave 6 branding", () => {
  it("binds purple tone to content primary token", () => {
    expect(QUERY_TONE_CLASS.purple).toMatch(/var\(--peaker-ui-PRIMARY\)/);
    expect(QUERY_TONE_CLASS.purple).not.toMatch(/#7c3aed/);
  });

  it("keeps semantic error and warning tones frozen", () => {
    expect(QUERY_TONE_CLASS.amber).toMatch(/amber-/);
    expect(QUERY_TONE_CLASS.red).toMatch(/red-/);
    expect(QUERY_TONE_CLASS.emerald).toMatch(/emerald-/);
    expect(QUERY_TONE_CLASS.gray).not.toMatch(/var\(--peaker-ui-PRIMARY\)/);
  });
});
