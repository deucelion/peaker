import { PATHS } from "@/lib/navigation/routeRegistry";
import { isUuid } from "@/lib/validation/uuid";

export type TahsilatMerkeziPrefill = {
  profileId: string;
  packageId?: string;
  paymentKind?: "monthly_membership" | "private_lesson_package" | "extra_charge";
  organizationId?: string | null;
};

/** Sporcu / paket bağlamından Tahsilat Merkezi'ne derin bağlantı (super_admin için `org` önerilir). */
export function hrefTahsilatMerkezi(p: TahsilatMerkeziPrefill): string {
  const q = new URLSearchParams();
  q.set("sporcu", p.profileId);
  if (p.packageId) q.set("paket", p.packageId);
  if (p.paymentKind) q.set("tur", p.paymentKind);
  if (p.organizationId && isUuid(p.organizationId)) q.set("org", p.organizationId);
  const s = q.toString();
  return s ? `${PATHS.tahsilatMerkezi}?${s}` : PATHS.tahsilatMerkezi;
}
