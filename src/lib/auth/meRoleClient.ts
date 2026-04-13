"use client";

import type { UserRole } from "@/lib/auth/roleMatrix";
import { getSafeRole } from "@/lib/auth/roleMatrix";

/** `/api/me-role` ile aynı kontrat; tek rol/org kaynağı. */
export type MeRoleClientSuccess = {
  ok: true;
  role: UserRole;
  fullName: string;
  organizationId: string | null;
  organizationName: string | null;
  userId: string;
  email: string | null;
};

export type MeRoleClientFailure = {
  ok: false;
  httpStatus: number;
  error: string;
  gateStatus?: string;
};

export type MeRoleClientPayload = MeRoleClientSuccess | MeRoleClientFailure;

export async function fetchMeRoleClient(): Promise<MeRoleClientPayload> {
  const res = await fetch("/api/me-role", { credentials: "same-origin", cache: "no-store" });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, httpStatus: res.status || 500, error: "unexpected_error" };
  }

  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      error: typeof body.error === "string" ? body.error : "unexpected_error",
      gateStatus: typeof body.organizationStatus === "string" ? body.organizationStatus : undefined,
    };
  }

  const roleRaw = typeof body.role === "string" ? body.role : "";
  const role = getSafeRole(roleRaw);
  if (!role) {
    return { ok: false, httpStatus: 403, error: "invalid_role" };
  }

  return {
    ok: true,
    role,
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    organizationId:
      body.organizationId === null || typeof body.organizationId === "string" ? (body.organizationId as string | null) : null,
    organizationName:
      body.organizationName === null || typeof body.organizationName === "string"
        ? (body.organizationName as string | null)
        : null,
    userId: typeof body.userId === "string" ? body.userId : "",
    email: body.email === null || typeof body.email === "string" ? (body.email as string | null) : null,
  };
}
