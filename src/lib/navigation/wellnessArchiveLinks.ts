import { PATHS } from "@/lib/navigation/routeRegistry";

export type WellnessArchiveLinkOptions = {
  athleteId?: string | null;
  athleteName?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
};

/** Wellness arşiv sayfasına filtre parametreleriyle link üretir. */
export function hrefWellnessArchive(options: WellnessArchiveLinkOptions = {}): string {
  const q = new URLSearchParams();
  const athleteId = options.athleteId?.trim();
  const athleteName = options.athleteName?.trim();
  if (athleteId) q.set("sporcu", athleteId);
  if (athleteName) q.set("q", athleteName);
  if (options.fromDate?.trim()) q.set("from", options.fromDate.trim());
  if (options.toDate?.trim()) q.set("to", options.toDate.trim());
  const query = q.toString();
  return query ? `${PATHS.performansWellnessDetay}?${query}` : PATHS.performansWellnessDetay;
}

export function parseWellnessArchiveSearchParams(input: {
  sporcu?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
}): { athleteId: string; searchTerm: string; fromDate: string; toDate: string } {
  return {
    athleteId: (input.sporcu || "").trim(),
    searchTerm: (input.q || "").trim(),
    fromDate: (input.from || "").trim(),
    toDate: (input.to || "").trim(),
  };
}
