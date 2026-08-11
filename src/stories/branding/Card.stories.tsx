import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Branding/Cards",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const UiCard: Story = {
  render: () => (
    <div className="ui-card w-full max-w-md">
      <p className="ui-h2-sm">Card title</p>
      <p className="ui-body mt-2">Default ui-card shell bound to content surface tokens.</p>
    </div>
  ),
};

export const UiCardChart: Story = {
  render: () => (
    <div className="ui-card-chart w-full max-w-md">
      <p className="ui-h2-sm">Chart card</p>
      <div className="ui-chart-shell mt-4 h-32 rounded-xl border border-white/5 bg-black/20" />
    </div>
  ),
};

export const UiCompactCard: Story = {
  render: () => (
    <div className="ui-compact-card w-full max-w-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Compact</p>
      <p className="mt-1 text-sm font-black text-white">ui-compact-card</p>
    </div>
  ),
};

export const UiToolbar: Story = {
  render: () => (
    <div className="ui-toolbar w-full max-w-md">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Toolbar</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="ui-btn-primary">
          Action
        </button>
        <button type="button" className="ui-btn-ghost">
          Secondary
        </button>
      </div>
    </div>
  ),
};
