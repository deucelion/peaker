import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type UiBreadcrumbItem = {
  label: string;
  href?: string;
};

export function UiBreadcrumb({
  items,
  className = "",
}: {
  items: ReadonlyArray<UiBreadcrumbItem>;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Konum" className={`ui-breadcrumb ${className}`.trim()}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="ui-breadcrumb__segment">
            {index > 0 ? <ChevronRight size={12} className="ui-breadcrumb__separator" aria-hidden /> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="ui-breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "ui-breadcrumb__current" : "ui-breadcrumb__text"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default UiBreadcrumb;
