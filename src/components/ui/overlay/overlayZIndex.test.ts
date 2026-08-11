import { describe, expect, it } from "vitest";
import {
  OVERLAY_PRIMITIVE_DEFAULTS,
  OVERLAY_Z,
  assertOverlayZRegistryUnique,
  overlayZIndex,
} from "./overlayZIndex";

describe("overlayZIndex", () => {
  it("exposes unique OVERLAY_Z registry values", () => {
    expect(() => assertOverlayZRegistryUnique()).not.toThrow();
  });

  it("returns numeric z-index for each registry layer", () => {
    expect(overlayZIndex(OVERLAY_Z.DIALOG)).toBe(50);
    expect(overlayZIndex(OVERLAY_Z.MODAL_ELEVATED)).toBe(120);
    expect(overlayZIndex(OVERLAY_Z.DRAWER_PRIORITY)).toBe(130);
  });

  it("documents primitive default layers", () => {
    expect(OVERLAY_PRIMITIVE_DEFAULTS.dialog).toBe(OVERLAY_Z.DIALOG);
    expect(OVERLAY_PRIMITIVE_DEFAULTS.backdrop).toBe(OVERLAY_Z.BACKDROP);
    expect(OVERLAY_PRIMITIVE_DEFAULTS.toast).toBe(OVERLAY_Z.TOAST);
  });

  it("orders elevated layers above standard dialogs", () => {
    expect(overlayZIndex(OVERLAY_Z.MODAL_ELEVATED)).toBeGreaterThan(overlayZIndex(OVERLAY_Z.DIALOG));
    expect(overlayZIndex(OVERLAY_Z.DRAWER_PRIORITY)).toBeGreaterThan(
      overlayZIndex(OVERLAY_Z.MODAL_ELEVATED)
    );
  });
});
