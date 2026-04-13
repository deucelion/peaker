import { getSafeRole } from "@/lib/auth/roleMatrix";
import type { MembershipSnapshot } from "@/lib/types/membership";

type RawRolePayload = {
  role?: string;
  fullName?: string;
};

export function mapMembership(raw: RawRolePayload | null | undefined): MembershipSnapshot {
  return {
    role: getSafeRole(raw?.role),
    fullName: raw?.fullName || "Peaker User",
  };
}
