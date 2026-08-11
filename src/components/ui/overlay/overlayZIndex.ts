/**
 * FAZ 34 Wave 7 — canonical overlay stacking registry.
 * Domain modals adopt these values in Waves 8–9; existing dialogs keep inline z until migrated.
 */
export enum OVERLAY_Z {
  /** Filter drawer backdrop, export menu, sheet backdrop base */
  BACKDROP = 40,
  /** Standard centered dialogs and finance modals */
  DIALOG = 50,
  /** Package list overlays */
  PACKAGE = 90,
  /** Mobile layout drawer backdrop */
  LAYOUT_BACKDROP = 100,
  /** Mobile sidebar chrome */
  LAYOUT_SIDEBAR = 110,
  /** Elevated domain modals (calendar, payments table) */
  MODAL_ELEVATED = 120,
  /** Offline/sync toast layer */
  TOAST = 125,
  /** Priority drawers and overlap confirm */
  DRAWER_PRIORITY = 130,
}

export type OverlayZLayer = OVERLAY_Z;

const OVERLAY_Z_VALUES = Object.values(OVERLAY_Z).filter(
  (value): value is number => typeof value === "number"
);

/** Returns the numeric z-index for a registry layer. */
export function overlayZIndex(layer: OverlayZLayer): number {
  return layer;
}

/** Ensures registry layers remain unique — used by unit tests and Wave 8 CI grep baseline. */
export function assertOverlayZRegistryUnique(): void {
  const unique = new Set(OVERLAY_Z_VALUES);
  if (unique.size !== OVERLAY_Z_VALUES.length) {
    throw new Error("OVERLAY_Z registry contains duplicate z-index values.");
  }
}

/** Maps primitive overlay roles to default registry layers. */
export const OVERLAY_PRIMITIVE_DEFAULTS = {
  backdrop: OVERLAY_Z.BACKDROP,
  dialog: OVERLAY_Z.DIALOG,
  drawer: OVERLAY_Z.DIALOG,
  sheet: OVERLAY_Z.DIALOG,
  menu: OVERLAY_Z.BACKDROP,
  toast: OVERLAY_Z.TOAST,
} as const;
