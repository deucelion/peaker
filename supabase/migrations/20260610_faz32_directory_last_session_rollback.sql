-- FAZ 32 ROLLBACK: dizin son-ders agregasyon RPC'sini kaldirir.
-- Uygulama RPC bulunamayinca eski (tum seanslari tasiyan) sorguya fallback yapar.

drop function if exists public.peaker_directory_last_completed_sessions(uuid);
