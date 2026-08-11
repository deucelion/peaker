import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FinanceExportMenu } from "@/components/finance/FinanceExportMenu";
import { UiTabsNav } from "@/components/ui/navigation/UiTabsNav";
import { UiBreadcrumb } from "@/components/ui/navigation/UiBreadcrumb";
import { chartTooltipContentStyle, chartTooltipItemStyle } from "@/lib/ui/branding/chartSelectors";

const meta = {
  title: "Branding/Floating UI/Wave 10",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const ExportMenu: Story = {
  render: () => (
    <FinanceExportMenu
      items={[
        { id: "csv", label: "CSV", description: "Tablo dışa aktar", onSelect: () => undefined },
        { id: "pdf", label: "PDF", description: "Özet rapor", onSelect: () => undefined },
      ]}
    />
  ),
};

export const TabsNav: Story = {
  render: () => (
    <UiTabsNav
      ariaLabel="Demo sekmeler"
      tabs={[
        { key: "a", label: "Genel", href: "#a", active: true },
        { key: "b", label: "Detay", href: "#b" },
        { key: "c", label: "Geçmiş", href: "#c" },
      ]}
    />
  ),
};

export const Breadcrumb: Story = {
  render: () => (
    <UiBreadcrumb
      items={[
        { label: "Performans", href: "/performans" },
        { label: "Sporcu", href: "/performans/sporcu" },
        { label: "Detay" },
      ]}
    />
  ),
};

export const ChartTooltipShell: Story = {
  render: () => {
    const contentStyle = chartTooltipContentStyle();
    const itemStyle = chartTooltipItemStyle();
    return (
      <div style={contentStyle} className="p-4">
        <p style={itemStyle}>Tooltip value · 42</p>
      </div>
    );
  },
};

export const InteractiveExportMenuEscape: Story = {
  render: () => {
    const [openHint, setOpenHint] = useState("Menüyü açın");
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">{openHint}</p>
        <FinanceExportMenu
          items={[{ id: "x", label: "Dışa aktar", onSelect: () => setOpenHint("Seçildi") }]}
        />
      </div>
    );
  },
};
