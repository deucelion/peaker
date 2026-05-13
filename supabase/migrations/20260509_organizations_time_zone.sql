-- ============================================================================
-- organizations.time_zone — multi-tenant timezone support
--
-- Multi-region (yurt içi/yurt dışı) firmalar için saat dilimi organizasyon
-- başına ayarlanmalıdır. Tüm dönem hesaplamaları (performans son N gün,
-- finans aylık aralık, takvim duvar saatleri) bu sabitten beslenecektir.
--
-- Geriye uyumluluk:
-- - Kolon eksikse eklenir, default 'Europe/Istanbul'.
-- - Mevcut kayıtlar varsayılana eşitlenir; sonradan admin paneli üzerinden
--   organizasyon başına değiştirilebilir.
-- - Bu migration tek başına idempotent çalışır; PostgREST cache reload
--   tetiklenir (notify pgrst).
-- ============================================================================

alter table public.organizations
  add column if not exists time_zone text;

update public.organizations
set time_zone = 'Europe/Istanbul'
where time_zone is null or btrim(time_zone) = '';

alter table public.organizations
  alter column time_zone set default 'Europe/Istanbul';

alter table public.organizations
  alter column time_zone set not null;

-- IANA timezone ID (Area/Location ya da UTC) doğrulaması; çok geniş tutuldu.
alter table public.organizations
  drop constraint if exists organizations_time_zone_check;

alter table public.organizations
  add constraint organizations_time_zone_check
  check (
    time_zone = 'UTC'
    or time_zone ~ '^[A-Za-z][A-Za-z0-9_+\-]*\/[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z][A-Za-z0-9_+\-]*)?$'
  );

comment on column public.organizations.time_zone is
  'Organizasyon yerel saat dilimi (IANA tz, ör. Europe/Istanbul, Europe/Berlin, UTC). Tüm dönem hesapları (performans, finans, takvim) bu değeri kullanır.';

notify pgrst, 'reload schema';
