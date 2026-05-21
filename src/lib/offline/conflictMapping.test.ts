import { describe, expect, it } from "vitest";
import { classifyReplayFailure, conflictUiForActionKind } from "@/lib/offline/conflictMapping";

describe("conflictMapping", () => {
  it("detects wellness duplicate as conflict", () => {
    expect(classifyReplayFailure("Bugün için kayıt zaten var")).toBe("conflict");
  });

  it("detects permission errors", () => {
    expect(classifyReplayFailure("Bu işlem için yetkiniz yok")).toBe("permission_denied");
  });

  it("wellness conflict hint is specific", () => {
    const ui = conflictUiForActionKind("wellness_draft", "Bugün zaten kayıtlı");
    expect(ui.kind).toBe("conflict");
    expect(ui.hint).toContain("sabah");
  });
});
