import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  OverlayBackdrop,
  OverlayContainer,
  OverlayDialog,
  OverlayFooter,
  OverlayMenu,
  OverlaySheet,
  OVERLAY_Z,
  overlayZIndex,
} from "@/components/ui/overlay";

const meta = {
  title: "Branding/Overlay/Primitives",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Backdrop: Story = {
  render: () => (
    <div className="relative h-64 overflow-hidden rounded-xl border border-white/10">
      <OverlayBackdrop onClose={() => undefined} />
      <p className="relative z-10 p-6 text-sm text-white">Backdrop preview</p>
    </div>
  ),
};

export const CenteredDialogShell: Story = {
  render: () => (
    <OverlayDialog open titleId="overlay-dialog-title" onClose={() => undefined}>
      <h2 id="overlay-dialog-title" className="text-sm font-black uppercase text-white">
        Dialog shell
      </h2>
      <p className="mt-2 text-xs text-gray-400">Centered overlay primitive — no domain content.</p>
      <OverlayFooter>
        <button type="button" className="ui-btn-ghost">
          Cancel
        </button>
        <button type="button" className="ui-btn-primary">
          Confirm
        </button>
      </OverlayFooter>
    </OverlayDialog>
  ),
};

export const BottomSheetShell: Story = {
  render: () => (
    <OverlaySheet open titleId="overlay-sheet-title" onClose={() => undefined}>
      <h2 id="overlay-sheet-title" className="text-sm font-black uppercase text-white">
        Sheet shell
      </h2>
      <p className="mt-2 text-xs text-gray-400">Bottom sheet primitive for Wave 9 adoption.</p>
    </OverlaySheet>
  ),
};

export const MenuShell: Story = {
  render: () => (
    <div className="p-6">
      <OverlayMenu labelledBy="overlay-menu-label">
        <p id="overlay-menu-label" className="sr-only">
          Menu shell
        </p>
        <button type="button" className="block w-full px-3 py-2 text-left text-xs text-white">
          Export CSV
        </button>
        <button type="button" className="block w-full px-3 py-2 text-left text-xs text-white">
          Export PDF
        </button>
      </OverlayMenu>
    </div>
  ),
};

export const StackOrder: Story = {
  render: () => (
    <div className="relative h-80">
      <OverlayContainer layer={OVERLAY_Z.DIALOG} className="ui-overlay-stage ui-overlay-stage--center">
        <OverlayBackdrop />
        <div
          className="ui-overlay-shell ui-dialog p-4"
          style={{ zIndex: overlayZIndex(OVERLAY_Z.DIALOG) }}
        >
          <p className="text-xs text-white">Dialog layer {overlayZIndex(OVERLAY_Z.DIALOG)}</p>
        </div>
      </OverlayContainer>
      <OverlayContainer
        layer={OVERLAY_Z.MODAL_ELEVATED}
        className="ui-overlay-stage ui-overlay-stage--center opacity-90"
      >
        <div className="ui-overlay-shell ui-dialog p-4">
          <p className="text-xs text-white">Elevated layer {overlayZIndex(OVERLAY_Z.MODAL_ELEVATED)}</p>
        </div>
      </OverlayContainer>
    </div>
  ),
};

export const FocusTrap: Story = {
  render: function FocusTrapStory() {
    const [open, setOpen] = useState(true);
    return (
      <div className="p-6">
        <button type="button" className="ui-btn-primary" onClick={() => setOpen(true)}>
          Open trap demo
        </button>
        <OverlayDialog open={open} titleId="focus-trap-title" onClose={() => setOpen(false)}>
          <h2 id="focus-trap-title" className="text-sm font-black uppercase text-white">
            Focus trap
          </h2>
          <div className="mt-4 flex gap-2">
            <button type="button" className="ui-btn-ghost">
              First
            </button>
            <button type="button" className="ui-btn-primary">
              Second
            </button>
          </div>
        </OverlayDialog>
      </div>
    );
  },
};
