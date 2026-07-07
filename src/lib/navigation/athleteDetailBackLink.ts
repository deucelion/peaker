import { PATHS } from "@/lib/navigation/routeRegistry";

export type AthleteDetailFromContext = "saha-testleri" | "performans" | "idman-raporu" | "oyuncular";

const BACK_BY_FROM: Record<AthleteDetailFromContext, { href: string; label: string }> = {
  "saha-testleri": { href: PATHS.sahaTestleri, label: "Saha test oturumuna dön" },
  performans: { href: PATHS.performans, label: "Yük analizine dön" },
  "idman-raporu": { href: PATHS.idmanRaporu, label: "Günlük idman raporuna dön" },
  oyuncular: { href: PATHS.oyuncular, label: "Kadro listesine dön" },
};

export function resolveAthleteDetailBackLink(
  from: string | null | undefined,
  options?: { sessionDate?: string | null }
): {
  href: string;
  label: string;
} {
  const key = (from || "").trim() as AthleteDetailFromContext;
  const sessionDate = options?.sessionDate?.trim();

  if (key === "saha-testleri" && sessionDate) {
    return {
      href: `${PATHS.sahaTestleri}/oturum/${sessionDate}`,
      label: "Saha test oturumuna dön",
    };
  }

  if (key && key in BACK_BY_FROM) {
    return BACK_BY_FROM[key];
  }
  return BACK_BY_FROM.oyuncular;
}

export function hrefAthleteDetail(
  profileId: string,
  from?: AthleteDetailFromContext,
  hash?: string,
  options?: { sessionDate?: string | null }
): string {
  const params = new URLSearchParams();
  if (from && from !== "oyuncular") {
    params.set("from", from);
  }
  const sessionDate = options?.sessionDate?.trim();
  if (sessionDate) {
    params.set("oturum", sessionDate);
  }
  const query = params.toString();
  const hashPart = hash ? `#${hash.replace(/^#/, "")}` : "";
  return `/sporcu/${profileId}${query ? `?${query}` : ""}${hashPart}`;
}
