export type SessionProfileRow = {
  role: string | null;
  full_name: string | null;
  organization_id: string | null;
  is_active: boolean | null;
};

/**
 * RLS satırı + JWT metadata birleşimi: yalnızca `profile?.role` truthy varsayımı
 * (role boş string / null) yüzünden geçerli kullanıcıların "profil eksik"e düşmesini engeller.
 */
export function mergeTenantProfileFromSources(args: {
  profile: SessionProfileRow | null;
  metaRole: string | null;
  metaFullName: string | null;
  metaOrgId: string | null;
}): SessionProfileRow & { role: string } | null {
  const p = args.profile;
  const fromRow = p?.role != null && String(p.role).trim() ? String(p.role).trim() : null;
  const fromMeta =
    args.metaRole != null && String(args.metaRole).trim() ? String(args.metaRole).trim() : null;
  const role = fromRow ?? fromMeta;
  if (!role) return null;

  return {
    role,
    full_name: p?.full_name ?? args.metaFullName ?? null,
    // Yalnizca DB (profiles.organization_id): JWT'deki org_id RLS ile organizations okumada kullanilamaz;
    // metadata org_id DB'de yoksa yanlis "Askida" (sorgu bos) regresyonu olur.
    organization_id: p?.organization_id ?? null,
    is_active: p?.is_active ?? true,
  };
}
