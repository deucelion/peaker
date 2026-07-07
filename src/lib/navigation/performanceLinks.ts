import type { PerformancePresetKey } from "@/lib/hooks/usePerformanceDashboard";
import { hrefAthleteDetail, type AthleteDetailFromContext } from "@/lib/navigation/athleteDetailBackLink";

export function hrefPerformansWithAthlete(athleteId: string, preset?: PerformancePresetKey): string {
  const q = new URLSearchParams();
  q.set("sporcu", athleteId);
  if (preset) q.set("range", preset);
  return `/performans?${q.toString()}`;
}

export function hrefAthleteDetailWithRange(
  profileId: string,
  options?: {
    from?: AthleteDetailFromContext;
    hash?: string;
    range?: PerformancePresetKey | string;
  }
): string {
  const base = hrefAthleteDetail(profileId, options?.from, options?.hash);
  if (!options?.range) return base;
  const [path, hashPart = ""] = base.split("#");
  const qIndex = path.indexOf("?");
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const existing = qIndex >= 0 ? path.slice(qIndex + 1) : "";
  const params = new URLSearchParams(existing);
  params.set("range", String(options.range));
  const query = params.toString();
  const hash = hashPart ? `#${hashPart}` : options?.hash ? `#${options.hash.replace(/^#/, "")}` : "";
  return `${pathname}?${query}${hash}`;
}

export function parsePerformansSearchParams(input: {
  sporcu?: string | null;
  range?: string | null;
}): { athleteId: string; range: PerformancePresetKey | null } {
  const athleteId = (input.sporcu || "").trim();
  const raw = (input.range || "").trim();
  const range =
    raw === "7" || raw === "14" || raw === "28" || raw === "90" ? (raw as PerformancePresetKey) : null;
  return { athleteId, range };
}
