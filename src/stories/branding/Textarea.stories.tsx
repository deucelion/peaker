import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Branding/Forms/Textarea",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Empty: Story = {
  render: () => (
    <textarea className="ui-textarea w-80" placeholder="Notes..." aria-label="Textarea empty" />
  ),
};

export const Filled: Story = {
  render: () => (
    <textarea
      className="ui-textarea w-80"
      defaultValue="Filled textarea content"
      aria-label="Textarea filled"
    />
  ),
};

export const Focused: Story = {
  render: () => (
    <textarea
      className="ui-textarea w-80"
      defaultValue="Focused textarea"
      autoFocus
      aria-label="Textarea focused"
    />
  ),
};
