import type { Meta, StoryObj } from "@storybook/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, ChartNoData, chartTooltipStyle } from "@/components/ui/charts";
import { chartTooltipContentStyle, chartTooltipItemStyle } from "@/lib/ui/branding/chartSelectors";

const meta = {
  title: "Branding/Charts/Wave 12",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const lineData = [
  { day: "Pzt", load: 420 },
  { day: "Sal", load: 510 },
  { day: "Çar", load: 380 },
  { day: "Per", load: 620 },
];

const barData = [
  { name: "A", value: 12 },
  { name: "B", value: 18 },
  { name: "C", value: 9 },
];

export const ChartFrameWithData: Story = {
  render: () => (
    <div className="ui-card-chart w-full max-w-xl p-4">
      <ChartFrame heightClassName="h-[220px]">
        <LineChart data={lineData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartTooltipStyle.contentStyle} itemStyle={chartTooltipStyle.itemStyle} />
          <Line type="monotone" dataKey="load" stroke="var(--peaker-ui-PRIMARY)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartFrame>
    </div>
  ),
};

export const ChartFrameEmpty: Story = {
  render: () => (
    <div className="ui-card-chart w-full max-w-xl p-4">
      <ChartFrame isEmpty emptyLabel="VERİ YOK" heightClassName="h-[180px]" />
    </div>
  ),
};

export const ChartNoDataStandalone: Story = {
  render: () => (
    <div className="ui-card-chart w-full max-w-md p-4">
      <ChartNoData label="Grafik verisi yok" />
    </div>
  ),
};

export const TooltipShell: Story = {
  render: () => {
    const contentStyle = chartTooltipContentStyle();
    const itemStyle = chartTooltipItemStyle();
    return (
      <div style={contentStyle} className="p-4">
        <p style={itemStyle}>Yük · 620 AU</p>
      </div>
    );
  },
};

export const BarChartShell: Story = {
  render: () => (
    <div className="ui-card-chart w-full max-w-xl p-4">
      <div className="ui-chart-shell h-[220px] w-full">
        <BarChart data={barData} width={480} height={220}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={chartTooltipStyle.contentStyle}
            itemStyle={chartTooltipStyle.itemStyle}
            labelStyle={chartTooltipStyle.labelStyle}
          />
          <Bar dataKey="value" fill="var(--peaker-ui-PRIMARY)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </div>
    </div>
  ),
};

export const RadarShell: Story = {
  render: () => (
    <div className="ui-chart-shell ui-chart-shell--passive w-full max-w-md rounded-xl border border-white/5 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Performance radar shell</p>
      <div className="mt-3 h-[140px] rounded-lg border border-white/5 bg-black/20" />
    </div>
  ),
};

export const KpiChartContainer: Story = {
  render: () => (
    <div className="ui-card-chart w-full max-w-xl p-5">
      <p className="ui-h2-sm">Yük dengesi</p>
      <div className="mt-4">
        <ChartFrame heightClassName="h-[200px]">
          <LineChart data={lineData}>
            <Line type="monotone" dataKey="load" stroke="var(--peaker-ui-PRIMARY)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartFrame>
      </div>
    </div>
  ),
};
