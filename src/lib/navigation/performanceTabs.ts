import { PATHS } from "@/lib/navigation/routeRegistry";

export type PerformanceTabKey = "yuk" | "saha" | "rapor";

export type PerformanceTabItem = {
  key: PerformanceTabKey;
  label: string;
  href: string;
};

export const PERFORMANCE_TABS: readonly PerformanceTabItem[] = [
  { key: "yuk", label: "Yük Analizi", href: PATHS.performans },
  { key: "saha", label: "Saha Testleri", href: PATHS.sahaTestleri },
  { key: "rapor", label: "İdman Raporu", href: PATHS.idmanRaporu },
] as const;

export function isPerformanceTabActive(tab: PerformanceTabItem, activeKey: PerformanceTabKey): boolean {
  return tab.key === activeKey;
}
