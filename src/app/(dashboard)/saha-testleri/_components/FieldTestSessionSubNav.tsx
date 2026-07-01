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

export function FieldTestSessionSubNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Saha testleri modülleri">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
              active
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
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
