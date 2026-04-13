export type { OrganizationStatus } from "@/lib/organization/lifecycle";

export interface OrganizationMembership {
  organizationId: string | null;
}

export interface TeamPaymentSummary {
  teamName: string;
  completionRate: number;
  pendingPlayers: number;
}
