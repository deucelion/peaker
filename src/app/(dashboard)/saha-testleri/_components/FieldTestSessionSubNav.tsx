"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isFieldTestSessionEntryPath } from "@/lib/fieldTests/fieldTestSessionRoutes";

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
    <nav
      className="ml-0 flex flex-wrap gap-1.5 border-l-2 border-[#7c3aed]/30 pl-3"
      aria-label="Saha testleri alt modülleri"
    >
      <span className="w-full text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 sm:w-auto sm:mr-1">
        Alt modül
      </span>
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-9 items-center rounded-full border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide ${
              active
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border-white/10 bg-white/[0.02] text-gray-400 hover:text-white"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
