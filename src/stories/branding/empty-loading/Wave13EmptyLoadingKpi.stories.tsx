import type { Meta, StoryObj } from "@storybook/react";
import { Inbox, Target } from "lucide-react";
import { CompactMetricCard } from "@/components/compact/CompactMetricCard";
import { AthleteEmptyState } from "@/components/athlete/AthleteEmptyState";
import { PerformanceOrgSummaryBand } from "@/components/performance/PerformanceOrgSummaryBand";
import EmptyState from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/data-display/LoadingState";
import { QueryLoadingShell, SoftRefreshIndicator } from "@/components/ui/loading/QueryLoadingShell";
import {
  SkeletonCard,
  SkeletonChart,
  SkeletonDashboardShell,
  SkeletonStat,
  SkeletonStatGrid,
} from "@/components/ui/skeletons";

const meta = {
  title: "Branding/Empty Loading KPI/Wave 13",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const EmptyCard: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <EmptyState variant="no_data" description="Bu aralıkta kayıt bulunamadı." compact />
    </div>
  ),
};

export const EmptyDashboard: Story = {
  render: () => (
    <div className="ui-card w-full max-w-2xl space-y-4 p-4">
      <EmptyState variant="filtered_empty" description="Filtreye uyan sonuç yok." />
      <EmptyState
        variant="onboarding"
        title="İlk sporcunu ekle"
        description="Organizasyonunuzda henüz sporcu yok."
        primaryAction={{ label: "Sporcu ekle", href: "/oyuncular" }}
      />
    </div>
  ),
};

export const EmptyStateVariants: Story = {
  render: () => (
    <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
      <EmptyState variant="no_data" description="Veri yok." compact />
      <EmptyState variant="no_permission" description="Yetkiniz yok." compact />
      <EmptyState variant="onboarding" description="Başlayın." compact />
      <EmptyState variant="filtered_empty" description="Filtre boş." compact />
      <EmptyState variant="error" description="Hata oluştu." compact />
    </div>
  ),
};

export const AthleteEmpty: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <AthleteEmptyState
        icon={Inbox}
        title="Henüz ölçüm yok"
        description="Bu sporcu için kayıtlı vücut ölçümü bulunmuyor."
        action={{ label: "Ölçüm ekle", href: "/sporcu/1" }}
      />
    </div>
  ),
};

export const KpiWidget: Story = {
  render: () => (
    <div className="grid w-full max-w-md gap-2">
      <CompactMetricCard label="Toplam sporcu" value={128} sublabel="Aktif kayıt" tone="neutral" icon={<Target size={16} />} />
      <CompactMetricCard label="Katılım" value="92%" tone="purple" />
      <CompactMetricCard label="Bekleyen" value={4} tone="amber" />
    </div>
  ),
};

export const KpiGrid: Story = {
  render: () => (
    <section className="ui-kpi-section w-full max-w-3xl">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-500">Özet</p>
      <div className="ui-kpi-grid">
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">Toplam ders</p>
          <p className="ui-kpi-card__value mt-0.5">42</p>
          <p className="ui-kpi-card__hint mt-1">Seçili dönem</p>
        </article>
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">Tamamlanan</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-200">38</p>
          <p className="ui-kpi-card__hint mt-1">Tamamlanan oturumlar</p>
        </article>
        <article className="ui-kpi-card">
          <p className="ui-kpi-card__label">İptal</p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-red-200">2</p>
          <p className="ui-kpi-card__hint mt-1">İptal edilen</p>
        </article>
        <article className="ui-kpi-card ui-kpi-chip--brand">
          <p className="ui-kpi-card__label">Marka KPI</p>
          <p className="ui-kpi-card__value mt-0.5">Primary</p>
          <p className="ui-kpi-card__hint mt-1">Organizasyon rengi</p>
        </article>
      </div>
    </section>
  ),
};

export const OrgSummaryBand: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <PerformanceOrgSummaryBand athleteCount={24} />
    </div>
  ),
};

export const SkeletonStatCard: Story = {
  render: () => (
    <div className="w-full max-w-xs">
      <SkeletonStat />
    </div>
  ),
};

export const SkeletonGrid: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <SkeletonStatGrid count={4} />
    </div>
  ),
};

export const SkeletonChartCard: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <SkeletonChart variant="line" height={220} />
    </div>
  ),
};

export const SkeletonDashboard: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <SkeletonDashboardShell statCount={4} />
    </div>
  ),
};

export const LoadingPanel: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <LoadingState label="Veriler yükleniyor" />
    </div>
  ),
};

export const LoadingInline: Story = {
  render: () => <LoadingState variant="inline" label="Yükleniyor" />,
};

export const QueryLoadingInline: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <QueryLoadingShell variant="inline" label="Sorgu yükleniyor" />
    </div>
  ),
};

export const SoftRefresh: Story = {
  render: () => <SoftRefreshIndicator active />,
};

export const SkeletonCardStory: Story = {
  name: "Skeleton Card",
  render: () => (
    <div className="w-full max-w-md">
      <SkeletonCard rows={4} />
    </div>
  ),
};

export const ProgressPlaceholder: Story = {
  name: "Progress / placeholder",
  render: () => (
    <div className="ui-kpi-card w-full max-w-sm space-y-3 p-4">
      <p className="ui-kpi-card__label">Yükleme ilerlemesi</p>
      <div className="ui-skeleton-pulse h-2 w-full rounded-full" />
      <div className="ui-skeleton-line h-3 w-2/3" />
      <LoadingState variant="inline" label="Senkronize ediliyor" />
    </div>
  ),
};
