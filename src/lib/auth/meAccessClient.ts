"use client";

import type { UserRole } from "@/lib/auth/roleMatrix";
import type { CoachPermissions, AthletePermissions } from "@/lib/types";

export type MeAccessClientPayload =
  | {
      ok: true;
      role: UserRole;
      coachPermissions: CoachPermissions | null;
      athletePermissions: AthletePermissions | null;
    }
  | {
      ok: false;
      error: string;
      httpStatus: number;
    };

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
  };
}

