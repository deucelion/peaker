import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "./defaults";
import { mergeBranding } from "./helpers";
import { mapThemeValidationErrors, validateThemeEditorInput } from "./editorValidation";

describe("editorValidation", () => {
  it("accepts default Peaker theme tokens", () => {
    const result = validateThemeEditorInput(createDefaultBranding().theme);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid hex colors with field errors", () => {
    const theme = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        primary: "not-a-color",
      },
    }).theme;

    const result = validateThemeEditorInput(theme);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.primary).toBeTruthy();
    }
  });

  it("rejects missing required token values", () => {
    const theme = {
      ...createDefaultBranding().theme,
      surface: "",
    };

    const fieldErrors = mapThemeValidationErrors(theme);
    expect(fieldErrors.surface).toBeTruthy();
  });

  it("rejects unknown theme token keys", () => {
    const theme = {
      ...createDefaultBranding().theme,
    };
    Object.assign(theme, { unknownToken: "#ffffff" });

    const fieldErrors = mapThemeValidationErrors(theme);
    expect(Object.keys(fieldErrors).length).toBeGreaterThan(0);
  });
});
