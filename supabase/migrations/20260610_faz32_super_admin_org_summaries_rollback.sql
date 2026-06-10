-- FAZ 32 ROLLBACK: super admin org ozet RPC'sini kaldirir.
-- Uygulama RPC bulunamayinca eski platform taramalarina fallback yapar.

drop function if exists public.peaker_super_admin_org_summaries(timestamptz, timestamptz);
