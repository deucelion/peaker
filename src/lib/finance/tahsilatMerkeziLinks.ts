import { PATHS } from "@/lib/navigation/routeRegistry";
import { isUuid } from "@/lib/validation/uuid";
import { hubSectionHref, type HubWorkspaceView } from "@/lib/finance/hubViews";

export type TahsilatMerkeziPrefill = {
  profileId: string;
  packageId?: string;
  paymentKind?: "monthly_membership" | "private_lesson_package" | "extra_charge";
  organizationId?: string | null;
};

/** Sporcu / paket bağlamından Tahsilat Merkezi'ne derin bağlantı (super_admin için `org` önerilir). */
export function hrefTahsilatMerkezi(p: TahsilatMerkeziPrefill): string {
  const q = new URLSearchParams();
  q.set("bolum", "tahsilat");
  q.set("sporcu", p.profileId);
  if (p.packageId) q.set("paket", p.packageId);
  if (p.paymentKind) q.set("tur", p.paymentKind);
  if (p.organizationId && isUuid(p.organizationId)) q.set("org", p.organizationId);
  return `${PATHS.tahsilatMerkezi}?${q.toString()}`;
}

/** Tahsilat Merkezi hub sekmesi */
export function hrefTahsilatHubSection(section: HubWorkspaceView, orgId?: string | null): string {
  return hubSectionHref(section, orgId);
}

/** Hızlı tahsilat kaydı (drawer açılır) */
export function hrefTahsilatKaydet(orgId?: string | null): string {
  const q = new URLSearchParams();
  q.set("bolum", "tahsilat");
  if (orgId?.trim()) q.set("org", orgId.trim());
  return `${PATHS.tahsilatMerkezi}?${q.toString()}`;
}
