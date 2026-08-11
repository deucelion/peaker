import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Branding/Forms/Select",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Closed: Story = {
  render: () => (
    <select className="ui-select w-80" defaultValue="a" aria-label="Select closed">
      <option value="a">Option A</option>
      <option value="b">Option B</option>
    </select>
  ),
};

export const Focused: Story = {
  render: () => (
    <select className="ui-select w-80" defaultValue="b" autoFocus aria-label="Select focused">
      <option value="a">Option A</option>
      <option value="b">Option B</option>
    </select>
  ),
};
