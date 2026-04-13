import { getSafeRole } from "@/lib/auth/roleMatrix";
import type { UserIdentity } from "@/lib/types/user";

type RawAuthUser = {
  id?: string;
  email?: string | null;
  user_metadata?: { full_name?: string };
};

type RawProfile = {
  role?: string | null;
  full_name?: string | null;
};

export function mapUser(rawUser: RawAuthUser | null | undefined, rawProfile?: RawProfile | null): UserIdentity | null {
  if (!rawUser?.id) return null;
  return {
    id: rawUser.id,
    email: rawUser.email ?? null,
    role: getSafeRole(rawProfile?.role),
    fullName: rawProfile?.full_name || rawUser.user_metadata?.full_name || "Peaker User",
  };
}
