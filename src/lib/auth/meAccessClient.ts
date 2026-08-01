"use client";

import type { UserRole } from "@/lib/auth/roleMatrix";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import type { CoachPermissions, AthletePermissions } from "@/lib/types";

export type MeAccessClientPayload =
  | {
      ok: true;
      role: UserRole;
      coachPermissions: CoachPermissions | null;
      athletePermissions: AthletePermissions | null;
      organizationFeatures: OrganizationFeatures;
      featuresRevision: number;
      organizationBranding: OrganizationBranding;
      brandingRevision: number;
    }
  | {
      ok: false;
      error: string;
      httpStatus: number;
    };

export function readOrganizationBrandingSnapshot(raw: unknown): OrganizationBranding {
  if (!raw || typeof raw !== "object") {
    return createDefaultBranding();
  }

  const candidate = raw as Partial<OrganizationBranding>;
  if (!candidate.theme || typeof candidate.theme !== "object") {
    return createDefaultBranding();
  }

  return raw as OrganizationBranding;
}

export async function fetchMeAccessClient(): Promise<MeAccessClientPayload> {
  const res = await fetch("/api/me-access", { credentials: "same-origin", cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: typeof body.error === "string" ? body.error : "unexpected_error",
      httpStatus: res.status || 500,
    };
  }

  return {
    ok: true,
    role: (body.role as UserRole) || "sporcu",
    coachPermissions: (body.coachPermissions as CoachPermissions | null) || null,
    athletePermissions: (body.athletePermissions as AthletePermissions | null) || null,
    organizationFeatures: body.organizationFeatures as OrganizationFeatures,
    featuresRevision: typeof body.featuresRevision === "number" ? body.featuresRevision : 0,
    organizationBranding: readOrganizationBrandingSnapshot(body.organizationBranding),
    brandingRevision: typeof body.brandingRevision === "number" ? body.brandingRevision : 0,
  };
}

