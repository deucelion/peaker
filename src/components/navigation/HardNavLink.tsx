"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

type HardNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
};

/**
 * Native anchor navigation for shell links. Avoids App Router soft-nav edge cases
 * on mobile/PWA where client transitions can fail silently.
 */
export function HardNavLink({ href, children, onClick, ...rest }: HardNavLinkProps) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
