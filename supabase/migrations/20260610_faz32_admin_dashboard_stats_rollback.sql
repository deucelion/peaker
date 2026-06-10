-- FAZ 32 ROLLBACK: admin panel agregasyon RPC'sini kaldirir.
-- Uygulama RPC bulunamayinca otomatik olarak eski (satir tasiyan) sorgulara
-- fallback yapar; davranis kaybi olmaz.

drop function if exists public.peaker_admin_dashboard_stats(uuid);
