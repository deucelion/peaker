import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Branding/Forms/Input",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Empty: Story = {
  render: () => <input className="ui-input w-80" placeholder="Placeholder" aria-label="Input empty" />,
};

export const Filled: Story = {
  render: () => (
    <input className="ui-input w-80" defaultValue="Filled value" aria-label="Input filled" />
  ),
};

export const Disabled: Story = {
  render: () => (
    <input className="ui-input w-80" defaultValue="Disabled" disabled aria-label="Input disabled" />
  ),
};

export const Focused: Story = {
  render: () => (
    <input
      className="ui-input w-80 ring-0"
      defaultValue="Focused"
      autoFocus
      aria-label="Input focused"
    />
  ),
};
