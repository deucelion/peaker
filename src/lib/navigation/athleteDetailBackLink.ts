import { PATHS } from "@/lib/navigation/routeRegistry";

export type AthleteDetailFromContext = "saha-testleri" | "performans" | "idman-raporu" | "oyuncular";

const BACK_BY_FROM: Record<AthleteDetailFromContext, { href: string; label: string }> = {
  "saha-testleri": { href: PATHS.sahaTestleri, label: "Saha testlerine dön" },
  performans: { href: PATHS.performans, label: "Performansa dön" },
  "idman-raporu": { href: PATHS.idmanRaporu, label: "İdman raporuna dön" },
  oyuncular: { href: PATHS.oyuncular, label: "Kadro analizine dön" },
};

export function resolveAthleteDetailBackLink(from: string | null | undefined): {
  href: string;
  label: string;
} {
  const key = (from || "").trim() as AthleteDetailFromContext;
  if (key && key in BACK_BY_FROM) {
    return BACK_BY_FROM[key];
  }
  return BACK_BY_FROM.oyuncular;
}

export function hrefAthleteDetail(
  profileId: string,
  from?: AthleteDetailFromContext,
  hash?: string
): string {
  const params = new URLSearchParams();
  if (from && from !== "oyuncular") {
    params.set("from", from);
  }
  const query = params.toString();
  const hashPart = hash ? `#${hash.replace(/^#/, "")}` : "";
  return `/sporcu/${profileId}${query ? `?${query}` : ""}${hashPart}`;
}
