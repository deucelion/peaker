import { UiBreadcrumb, type UiBreadcrumbItem } from "@/components/ui/navigation/UiBreadcrumb";

export type BreadcrumbItem = UiBreadcrumbItem;

type PerformanceBreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function PerformanceBreadcrumb({ items, className = "" }: PerformanceBreadcrumbProps) {
  return <UiBreadcrumb items={items} className={className} />;
}
