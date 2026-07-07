import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PerformanceBreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function PerformanceBreadcrumb({ items, className = "" }: PerformanceBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Konum" className={`flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <ChevronRight size={12} className="shrink-0 opacity-50" aria-hidden /> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-[#c4b5fd] hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-gray-300" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
