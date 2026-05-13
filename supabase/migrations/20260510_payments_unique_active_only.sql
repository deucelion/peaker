-- ============================================================================
-- payments: aktif satırlar için kısmi (partial) unique index'e geçiş.
--
-- Önceki index:
--   uq_payments_org_profile_type_due (organization_id, profile_id,
--                                     payment_type, due_date)
--   WHERE profile_id IS NOT NULL AND due_date IS NOT NULL
--
-- Sorun: predicate `deleted_at IS NULL` içermiyordu. Bir aidat satırı
-- soft-delete (deleted_at SET) edildikten sonra aynı (org, profile, type,
-- due_date) için yeni bir AKTİF satır eklenmeye çalışıldığında, eski (silinmiş)
-- satır hâlâ index içinde olduğu için 23505 unique violation üretiyordu.
--
-- Bu migration:
--   1) Hiçbir aktif duplicate yokken (olamaması gerekir; eski index zaten
--      hepsini koruyordu) güvenlik kontrolü yapar.
--   2) Eski global index'i drop eder.
--   3) Sadece `deleted_at IS NULL` satırlarını kapsayan yeni partial unique
--      index oluşturur.
--   4) Diagnostik (production_hardening_health) fonksiyonu hem eski hem
--      yeni index adını tanır → backward-compatible.
--
-- Backward-compat:
--   * Hiçbir veri silinmez.
--   * `markPlannedAidatAsPaidForManagement` upsert path'i (onConflict
--     "organization_id,profile_id,payment_type,due_date") aynı kolon
--     setine kurulu yeni partial unique index'i kullanmaya devam eder.
--   * 42P10 fallback yolu zaten mevcut; PG inference olmasa bile kayıt
--     güvenli kalır.
-- ============================================================================

-- 1) Aktif duplicate guard'ı: emin olmak için kontrol; çıkarsa migration durur.
do $$
declare
  active_dups integer;
begin
  select count(*) into active_dups
  from (
    select 1
    from public.payments
    where profile_id is not null
      and due_date is not null
      and deleted_at is null
    group by organization_id, profile_id, payment_type, due_date
    having count(*) > 1
  ) d;

  if active_dups > 0 then
    raise exception
      'payments tablosunda % aktif (org, profile, payment_type, due_date) duplicate grubu var. '
      'Migration durduruldu; veriyi temizledikten sonra tekrar deneyin.',
      active_dups;
  end if;
end $$;

-- 2) Eski global index'i kaldır (silinmiş satırları da kapsayan eski index).
drop index if exists public.uq_payments_org_profile_type_due;

-- 3) Sadece aktif satırları kapsayan yeni partial unique index.
create unique index if not exists uq_payments_org_profile_type_due_active
  on public.payments (organization_id, profile_id, payment_type, due_date)
  where profile_id is not null
    and due_date is not null
    and deleted_at is null;

-- 4) Diagnostik fonksiyonu: hem eski hem yeni index adını kabul et.
create or replace function public.production_hardening_health()
returns table (
  onboarding_bundle_rpc_ready boolean,
  private_lesson_usage_atomic_rpc_ready boolean,
  private_lesson_payment_atomic_rpc_ready boolean,
  payments_decrement_atomic_rpc_ready boolean,
  payments_unique_due_index_ready boolean
)
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'create_athlete_onboarding_bundle'
    ) as onboarding_bundle_rpc_ready,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'private_lesson_apply_usage_atomic'
    ) as private_lesson_usage_atomic_rpc_ready,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'private_lesson_apply_payment_atomic'
    ) as private_lesson_payment_atomic_rpc_ready,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'payments_decrement_package_session_atomic'
    ) as payments_decrement_atomic_rpc_ready,
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'uq_payments_org_profile_type_due',
          'uq_payments_org_profile_type_due_active'
        )
    ) as payments_unique_due_index_ready;
$$;

grant execute on function public.production_hardening_health()
  to authenticated, service_role;

-- 5) PostgREST schema cache'ini yenile.
notify pgrst, 'reload schema';
