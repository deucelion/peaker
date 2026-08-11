import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Branding/Badges",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const SemanticSet: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <span className="ui-badge-neutral">Neutral</span>
      <span className="ui-badge-success">Success</span>
      <span className="ui-badge-warning">Warning</span>
      <span className="ui-badge-danger">Danger</span>
    </div>
  ),
};
