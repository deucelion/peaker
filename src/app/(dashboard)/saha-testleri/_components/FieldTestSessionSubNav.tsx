"use client";

import { usePathname } from "next/navigation";
import { isFieldTestSessionEntryPath } from "@/lib/fieldTests/fieldTestSessionRoutes";
import { UiTabsNav } from "@/components/ui/navigation/UiTabsNav";

const ITEMS = [
  {
    href: "/saha-testleri",
    label: "Test oturumu",
    match: (p: string) => isFieldTestSessionEntryPath(p),
  },
  {
    href: "/saha-testleri/metrikler",
    label: "Metrikler",
    match: (p: string) => p.startsWith("/saha-testleri/metrikler"),
  },
  {
    href: "/saha-testleri/genel-rapor",
    label: "Takım raporu",
    match: (p: string) => p.startsWith("/saha-testleri/genel-rapor"),
  },
] as const;

/** Saha testleri alt modül sekmeleri — performans üst sekmelerinden görsel olarak ayrışır. */
export function FieldTestSessionSubNav() {
  const pathname = usePathname() || "";

  return (
    <UiTabsNav
      ariaLabel="Saha testleri alt modülleri"
      subModule
      size="sm"
      prefix={
        <span className="w-full text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 sm:mr-1 sm:w-auto">
          Alt modül
        </span>
      }
      tabs={ITEMS.map((item) => ({
        key: item.href,
        label: item.label,
        href: item.href,
        active: item.match(pathname),
      }))}
    />
  );
}
