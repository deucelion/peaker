import type { UserRole } from "@/lib/auth/roleMatrix";

export interface MembershipSnapshot {
  role: UserRole | null;
  fullName: string;
}
