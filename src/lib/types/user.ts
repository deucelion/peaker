import type { UserRole } from "@/lib/auth/roleMatrix";

export interface UserIdentity {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole | null;
}
