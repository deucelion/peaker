"use client";

import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { BrandingUiProvider } from "@/lib/ui/branding/BrandingUiProvider";
import { useMeAccess } from "@/lib/auth/useMeAccess";
import type { ReactNode } from "react";

export function DashboardBrandingContent({ children }: { children: ReactNode }) {
  const { payload, ready } = useMeAccess();
  const organizationBranding = payload?.ok
    ? payload.organizationBranding
    : createDefaultBranding();

  return (
    <BrandingUiProvider organizationBranding={organizationBranding} ready={ready}>
      {children}
    </BrandingUiProvider>
  );
}
