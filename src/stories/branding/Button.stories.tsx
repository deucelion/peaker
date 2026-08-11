import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Branding/Buttons",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Primary: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <button type="button" className="ui-btn-primary">
        Primary
      </button>
      <button type="button" className="ui-btn-primary" disabled>
        Disabled
      </button>
    </div>
  ),
};

export const Ghost: Story = {
  render: () => (
    <button type="button" className="ui-btn-ghost">
      Ghost
    </button>
  ),
};

export const Danger: Story = {
  render: () => (
    <button type="button" className="ui-btn-danger">
      Danger
    </button>
  ),
};

export const LoadMore: Story = {
  render: () => (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-[var(--peaker-ui-SURFACE)] px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 sm:hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] sm:hover:bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)]"
    >
      Daha fazla yukle (12/40)
    </button>
  ),
};
