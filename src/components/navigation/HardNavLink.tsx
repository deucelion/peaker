"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type HardNavLinkProps = Omit<ComponentProps<typeof Link>, "href" | "children"> & {
  href: string;
  children: ReactNode;
};

/** Dashboard shell links — client navigation without full document reload. */
export function HardNavLink({ href, children, prefetch = false, ...rest }: HardNavLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} {...rest}>
      {children}
    </Link>
  );
}
