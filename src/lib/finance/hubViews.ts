import { PATHS } from "@/lib/navigation/routeRegistry";

/** Tahsilat Merkezi üst sekmeleri */
export type HubWorkspaceView = "ozet" | "tahsilatlar" | "alacaklar" | "sporcular" | "koclar";

const LEGACY_ALIASES: Record<string, HubWorkspaceView> = {
  ozet: "ozet",
  tahsilatlar: "tahsilatlar",
  panel: "tahsilatlar",
  genel: "tahsilatlar",
  alacaklar: "alacaklar",
  alacak: "alacaklar",
  sporcular: "sporcular",
  sporcu: "sporcular",
  koclar: "koclar",
  koc: "koclar",
};

export function normalizeHubView(raw: string | null | undefined): HubWorkspaceView | null {
  const key = (raw || "").trim().toLowerCase();
  if (!key) return null;
  return LEGACY_ALIASES[key] ?? null;
}

export function resolveHubView(input: { bolum?: string | null }): HubWorkspaceView {
  const normalized = normalizeHubView(input.bolum);
  if (normalized) return normalized;
  return "ozet";
}

export function hubSectionHref(section: HubWorkspaceView, orgId?: string | null): string {
  const q = new URLSearchParams();
  if (section !== "ozet") q.set("bolum", section);
  if (orgId?.trim()) q.set("org", orgId.trim());
  const s = q.toString();
  return s ? `${PATHS.tahsilatMerkezi}?${s}` : PATHS.tahsilatMerkezi;
}

export const HUB_TAB_LABELS: Record<HubWorkspaceView, string> = {
  ozet: "Özet",
  tahsilatlar: "Tahsilatlar",
  alacaklar: "Alacaklar",
  sporcular: "Sporcular",
  koclar: "Koçlar",
};
