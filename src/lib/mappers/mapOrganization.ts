import type { OrganizationMembership, TeamPaymentSummary } from "@/lib/types/organization";

type RawProfileOrg = {
  organization_id?: string | null;
};

type RawTeamProfile = {
  team?: string | null;
  payments?: Array<{ status?: string | null }> | null;
};

export function mapOrganization(rawProfile: RawProfileOrg | null | undefined): OrganizationMembership {
  return {
    organizationId: rawProfile?.organization_id ?? null,
  };
}

export function mapTeamPaymentSummaries(rawPlayers: RawTeamProfile[] | null | undefined): TeamPaymentSummary[] {
  if (!rawPlayers?.length) return [];

  const grouped = new Map<string, { totalPayments: number; paidPayments: number; pendingPlayers: number }>();
  rawPlayers.forEach((player) => {
    const teamName = player.team || "GENEL";
    const payments = player.payments || [];
    const paidCount = payments.filter((p) => p.status === "odendi").length;
    const hasPending = payments.some((p) => p.status === "bekliyor");

    if (!grouped.has(teamName)) {
      grouped.set(teamName, { totalPayments: 0, paidPayments: 0, pendingPlayers: 0 });
    }
    const current = grouped.get(teamName)!;
    current.totalPayments += payments.length;
    current.paidPayments += paidCount;
    if (hasPending) current.pendingPlayers += 1;
  });

  return Array.from(grouped.entries())
    .map(([teamName, value]) => ({
      teamName,
      completionRate: value.totalPayments > 0 ? Math.round((value.paidPayments / value.totalPayments) * 100) : 100,
      pendingPlayers: value.pendingPlayers,
    }))
    .sort((a, b) => b.completionRate - a.completionRate);
}
