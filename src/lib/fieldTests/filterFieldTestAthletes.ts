import type { ProfileBasic } from "@/types/domain";

export function normalizeFieldTestSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase("tr");
}

export function filterFieldTestAthletes(players: ProfileBasic[], query: string): ProfileBasic[] {
  const q = normalizeFieldTestSearchQuery(query);
  if (!q) return players;
  return players.filter((p) => normalizeFieldTestSearchQuery(p.full_name).includes(q));
}
