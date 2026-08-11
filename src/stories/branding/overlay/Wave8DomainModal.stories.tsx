import type { Meta, StoryObj } from "@storybook/react";
import { PrivateLessonSlotOverlapConfirmModal } from "@/components/privateLessons/PrivateLessonSlotOverlapConfirmModal";
import type { PrivateLessonSlotOverlapPreviewResult } from "@/lib/privateLessons/privateLessonSlotOverlap";

const previewFixture: PrivateLessonSlotOverlapPreviewResult = {
  slotStartsAt: "2026-07-25T10:00:00.000Z",
  slotEndsAt: "2026-07-25T11:00:00.000Z",
  overlappingCount: 2,
  capacityLevel: "warning",
  totalAfterCreate: 3,
  newAthleteName: "Ayşe Yılmaz",
  peers: [
    {
      id: "peer-1",
      athleteName: "Mehmet Demir",
      packageName: "8'li paket",
      startsAt: "2026-07-25T10:00:00.000Z",
      endsAt: "2026-07-25T11:00:00.000Z",
    },
    {
      id: "peer-2",
      athleteName: "Zeynep Kaya",
      packageName: "4'lü paket",
      startsAt: "2026-07-25T10:00:00.000Z",
      endsAt: "2026-07-25T11:00:00.000Z",
    },
  ],
};

const meta = {
  title: "Branding/Overlay/Wave 8 Domain Modal",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

/** Wave 8 — migrated domain modal using OverlayDialog + OverlayFooter + OVERLAY_Z.DRAWER_PRIORITY */
export const SlotOverlapConfirm: Story = {
  render: () => (
    <PrivateLessonSlotOverlapConfirmModal
      preview={previewFixture}
      busy={false}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />
  ),
};
